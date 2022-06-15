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
      url: urlPrefix + 'game/room/create/auth',
      method: 'get',
      params,
    })
  },

  getRoomInfo (params) {
    return fetch({
      url: urlPrefix + 'game/room/info/auth',
      method: 'get',
      params,
    })
  },

  joinRoom (params) {
    return fetch({
      url: urlPrefix + 'game/room/join/auth',
      method: 'get',
      params,
    })
  },

  seatIn (params) {
    return fetch({
      url: urlPrefix + 'game/desk/seatIn/auth',
      method: 'get',
      params,
    })
  },

  kickPlayer (params) {
    return fetch({
      url: urlPrefix + 'game/room/kickPlayer/auth',
      method: 'get',
      params,
    })
  },

  quitRoom (params) {
    return fetch({
      url: urlPrefix + 'game/room/quit/auth',
      method: 'get',
      params,
    })
  },

  modifyNameInRoom (params) {
    return fetch({
      url: urlPrefix + 'game/room/modifyName/auth',
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
  }

}
