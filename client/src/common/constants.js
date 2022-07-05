import predictor from "@assets/images/role/card/yuyanjia.png"
import hunter from "@assets/images/role/card/lieren.png"
import witch from "@assets/images/role/card/nvwu.png"
import villager from "@assets/images/role/card/pingming.png"
import wolf from "@assets/images/role/card/langren.png"

const roleCardMap = {
  'predictor': predictor,
  'hunter': hunter,
  'witch': witch,
  'villager': villager,
  'wolf': wolf,
}

const modalDescMap = {
  'check': {
    title: '查验一位玩家',
    className: 'btn-primary',
    buttonText: '查验他',
    resultTitle: '查验结果'
  },
  'assault': {
    title: '袭击一位玩家',
    className: 'btn-folk',
    buttonText: '袭击他',
    resultTitle: '袭击结果',
    resultDesc: '你袭击了'
  },
  'poison': {
    title: '使用毒药',
    className: 'btn-error',
    buttonText: '撒毒',
    resultTitle: '撒毒结果',
    resultDesc: '你毒死了'
  },
  'shoot': {
    title: '开枪带走一位玩家',
    className: 'btn-warning',
    buttonText: '开枪',
    resultTitle: '开枪结果',
    resultDesc: '你开枪带走了'
  },
  'vote': {
    title: '投票放逐一位玩家',
    className: 'btn-primary',
    buttonText: '投票',
    resultTitle: '投票结果',
    resultDesc: '你投票放逐了'
  },
  'antidote': {
    title: '确定要使用解药救该玩家吗？',
  },
  'boom': {
    title: '确定要自爆吗（自爆之后直接进入天黑）？',
  }
}
export default {
  roleCardMap,
  modalDescMap
}
