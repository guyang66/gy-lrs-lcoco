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
  }

}
