import fetch from '@common/fetch'

const urlPrefix = '/api/'

export default {

  getUserMenu(params) {
    return fetch({
      url: urlPrefix + 'menu/auth',
      method: 'get',
      params,
    })
  },

  getRoute(params) {
    return fetch({
      url: urlPrefix + 'route/auth',
      method: 'get',
      params,
    })
  },

  getMenuList(param) {
    return fetch({
      url: urlPrefix + 'menu/list/auth',
      method: 'post',
      data: param,
    })
  },

  getRouteList(param) {
    return fetch({
      url: urlPrefix + 'route/list/auth',
      method: 'post',
      data: param,
    })
  },
  getUiPermission(params) {
    return fetch({
      url: urlPrefix + 'permission/ui/auth',
      method: 'get',
      params,
    })
  },
}
