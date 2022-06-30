import fetch from '@common/fetch'

const urlPrefix = '/api/'

export default {

  getRoute(params) {
    return fetch({
      url: urlPrefix + 'route/auth',
      method: 'get',
      params,
    })
  },

  getUiPermission(params) {
    return fetch({
      url: urlPrefix + 'permission/ui/auth',
      method: 'get',
      params,
    })
  },

  createRoom (params) {
    return fetch({
      url: urlPrefix + 'room/create/auth',
      method: 'get',
      params,
    })
  },

  getRoomInfo (params) {
    return fetch({
      url: urlPrefix + 'room/info/auth',
      method: 'get',
      params,
    })
  },

  joinRoom (params) {
    return fetch({
      url: urlPrefix + 'room/join/auth',
      method: 'get',
      params,
    })
  },

  seatIn (params) {
    return fetch({
      url: urlPrefix + 'room/seat/auth',
      method: 'get',
      params,
    })
  },

  kickPlayer (params) {
    return fetch({
      url: urlPrefix + 'room/kick/auth',
      method: 'get',
      params,
    })
  },

  quitRoom (params) {
    return fetch({
      url: urlPrefix + 'room/quit/auth',
      method: 'get',
      params,
    })
  },

  modifyNameInRoom (params) {
    return fetch({
      url: urlPrefix + 'room/modifyName/auth',
      method: 'get',
      params,
    })
  },

  startGame (params) {
    return fetch({
      url: urlPrefix + 'game/start/auth',
      method: 'get',
      params,
    })
  },

  getGameInfo (params) {
    return fetch({
      url: urlPrefix + 'game/info/auth',
      method: 'get',
      params,
    })
  },

  nextStage (params) {
    return fetch({
      url: urlPrefix + 'game/nextStage/auth',
      method: 'get',
      params,
    })
  },

  userNextStage (params) {
    return fetch({
      url: urlPrefix + 'game/userNextStage/auth',
      method: 'get',
      params,
    })
  },

  gameRecord (params) {
    return fetch({
      url: urlPrefix + 'game/record/auth',
      method: 'get',
      params,
    })
  },

  checkPlayerRole (params) {
    return fetch({
      url: urlPrefix + 'game/checkPlayer/auth',
      method: 'get',
      params,
    })
  },

  assaultPlayer (params) {
    return fetch({
      url: urlPrefix + 'game/assaultPlayer/auth',
      method: 'get',
      params,
    })
  },

  antidotePlayer (params) {
    return fetch({
      url: urlPrefix + 'game/antidotePlayer/auth',
      method: 'get',
      params,
    })
  },

  votePlayer (params) {
    return fetch({
      url: urlPrefix + 'game/votePlayer/auth',
      method: 'get',
      params,
    })
  },

  poisonPlayerRole (params) {
    return fetch({
      url: urlPrefix + 'game/poisonPlayer/auth',
      method: 'get',
      params,
    })
  },

  shootPlayerRole (params) {
    return fetch({
      url: urlPrefix + 'game/shootPlayer/auth',
      method: 'get',
      params,
    })
  },

  boomAction (params) {
    return fetch({
      url: urlPrefix + 'game/boomPlayer/auth',
      method: 'get',
      params,
    })
  }

}
