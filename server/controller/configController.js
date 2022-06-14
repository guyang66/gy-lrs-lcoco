module.exports = app => ({
  /**
   * 获取所有可用的路由
   * @returns {Promise<void>}
   */
  async getRoute() {
    const { ctx, $service, $helper } = app
    let r = await $service.adminRouteService.getAdminRoute()
    //todo: 只有成功的return 都要加try catch 处理错误
    ctx.body = $helper.Result.success(r)
  },

  async getUiPermission () {
    const { ctx, $service, $helper, $model  } = app
    const { uiPermission } = $model
    let r = await $service.baseService.query(uiPermission, {status: 1})
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '查询失败！')
    }
  },


})
