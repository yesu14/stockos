// 박스 옮기기 창: 선반 그림(전체보기)에서 놓을 자리를 눌러서 옮김 — 빈 자리는 바로 옮기고, 박스가 있는 자리는 "서로 바꾸기 / 끼워 넣기" 를 고름
import { Modal, Btn } from './ui'
import AllView from './AllView'
import { locationText } from './whLogic'

export default function MoveBoxDialog({ boxId, model, onPlace, onClose }) {
  const box = model.boxesById.get(boxId)
  if (!box) return null
  return (
    <Modal onClose={onClose} level={2} width="max-w-3xl" accent={box.zoneColor} icon="↔️" title={`박스 ${box.box_number} 옮기기`} subtitle={`지금 위치: ${locationText(box)}`} footer={<Btn variant="soft" onClick={onClose}>닫기</Btn>}>
      <AllView embedded canEdit model={model} movingId={boxId} onPlace={onPlace} onDone={onClose} />
    </Modal>
  )
}
