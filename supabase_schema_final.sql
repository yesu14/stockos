-- =============================================
-- 전체 재고관리 시스템 스키마 (최종)
-- categories, subcategories, products 모두 name 하나만 사용
-- =============================================

-- 기존 테이블 삭제
DROP TABLE IF EXISTS stock_logs CASCADE;
DROP TABLE IF EXISTS inbound_items CASCADE;
DROP TABLE IF EXISTS inbound_orders CASCADE;
DROP TABLE IF EXISTS product_skus CASCADE;
DROP TABLE IF EXISTS product_options CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS storage_locations CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS trusted_devices CASCADE;
DROP TABLE IF EXISTS login_logs CASCADE;
DROP TABLE IF EXISTS menus CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- =============================================
-- 1. 사용자 프로필
-- =============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email VARCHAR NOT NULL,
  name VARCHAR,
  role VARCHAR DEFAULT 'pending',
  is_approved BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. 디바이스 기억
-- =============================================
CREATE TABLE trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name VARCHAR,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. 로그인 기록
-- =============================================
CREATE TABLE login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address VARCHAR,
  device_info TEXT,
  device_fingerprint TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. 메뉴 관리
-- =============================================
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES menus(id),
  name_ko VARCHAR NOT NULL,
  name_zh VARCHAR,
  name_en VARCHAR,
  url VARCHAR,
  icon VARCHAR,
  sort_order INT DEFAULT 0,
  permission_role VARCHAR DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO menus (name_ko, name_zh, name_en, url, icon, sort_order, permission_role) VALUES
('대시보드',   '仪表盘',   'Dashboard',  '/dashboard',  'LayoutDashboard', 1, 'viewer'),
('카테고리',   '分类管理', 'Categories', '/categories', 'FolderOpen',      2, 'manager'),
('상품관리',   '商品管理', 'Products',   '/products',   'Package',         3, 'manager'),
('입고관리',   '入库管理', 'Inbound',    '/inbound',    'PackageCheck',    4, 'manager'),
('재고관리',   '库存管理', 'Inventory',  '/inventory',  'Boxes',           5, 'viewer'),
('관리자',     '管理员',   'Admin',      '/admin',      'Shield',          6, 'admin');

-- =============================================
-- 5. 저장위치
-- =============================================
CREATE TABLE storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO storage_locations (name, description) VALUES
('창고 A-1', '왼쪽 첫번째 줄'),
('창고 A-2', '왼쪽 두번째 줄'),
('창고 B-1', '오른쪽 첫번째 줄'),
('창고 B-2', '오른쪽 두번째 줄');

-- =============================================
-- 6. 브랜드
-- =============================================
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. 대분류
-- =============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. 소분류
-- =============================================
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  code VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. 상품 (name 하나만)
-- =============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id),
  subcategory_id UUID REFERENCES subcategories(id),
  brand_id UUID REFERENCES brands(id),
  code VARCHAR,
  name VARCHAR NOT NULL,
  sort_order INT DEFAULT 0,
  storage_location_id UUID REFERENCES storage_locations(id),
  sale_price DECIMAL(12,2) DEFAULT 0,
  cost_price DECIMAL(12,2) DEFAULT 0,
  note TEXT,
  image_url TEXT,
  option_count INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. 옵션 (option_name + option_value 분리)
-- =============================================
CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  option_number INT NOT NULL,
  option_name VARCHAR NOT NULL,
  option_value VARCHAR NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. SKU (옵션 조합별 재고)
-- =============================================
CREATE TABLE product_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  option1_id UUID REFERENCES product_options(id) ON DELETE CASCADE,
  option2_id UUID REFERENCES product_options(id),
  stock INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. 입고
-- =============================================
CREATE TABLE inbound_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR NOT NULL UNIQUE,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inbound_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_order_id UUID REFERENCES inbound_orders(id) ON DELETE CASCADE,
  product_sku_id UUID REFERENCES product_skus(id),
  quantity INT NOT NULL,
  cost_price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 13. 재고 변동 기록
-- =============================================
CREATE TABLE stock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_sku_id UUID REFERENCES product_skus(id),
  change_type VARCHAR NOT NULL,
  quantity_before INT,
  quantity_change INT,
  quantity_after INT,
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS 정책
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만
CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (auth.uid() = id);

-- 승인된 사용자 조회
CREATE POLICY "approved_read_categories"     ON categories       FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));
CREATE POLICY "approved_read_subcategories"  ON subcategories    FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));
CREATE POLICY "approved_read_products"       ON products         FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));
CREATE POLICY "approved_read_options"        ON product_options  FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));
CREATE POLICY "approved_read_skus"           ON product_skus     FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));
CREATE POLICY "approved_read_locations"      ON storage_locations FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));
CREATE POLICY "approved_read_inbound"        ON inbound_orders   FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));
CREATE POLICY "approved_read_inbound_items"  ON inbound_items    FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));
CREATE POLICY "approved_read_stock_logs"     ON stock_logs       FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE is_approved = TRUE));

-- manager 이상 전체 권한
CREATE POLICY "manager_write_categories"    ON categories       FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_subcategories" ON subcategories    FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_products"      ON products         FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_options"       ON product_options  FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_skus"          ON product_skus     FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_locations"     ON storage_locations FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_inbound"       ON inbound_orders   FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_inbound_items" ON inbound_items    FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_stock_logs"    ON stock_logs       FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','manager') AND is_approved = TRUE));
CREATE POLICY "manager_write_trusted"       ON trusted_devices  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "manager_write_login_logs"    ON login_logs       FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 트리거: 입고시 재고 자동 업데이트
-- =============================================
CREATE OR REPLACE FUNCTION update_stock_on_inbound()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE product_skus
  SET stock = stock + NEW.quantity, updated_at = NOW()
  WHERE id = NEW.product_sku_id;

  INSERT INTO stock_logs (product_sku_id, change_type, quantity_change, note, created_by)
  VALUES (NEW.product_sku_id, 'inbound', NEW.quantity, '입고',
    (SELECT created_by FROM inbound_orders WHERE id = NEW.inbound_order_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_inbound
AFTER INSERT ON inbound_items
FOR EACH ROW EXECUTE FUNCTION update_stock_on_inbound();
