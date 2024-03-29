module.exports = app => ({
  /**
   * 获取所有可用的路由
   * @returns {Promise<void>}
   */
  async getRoute(ctx) {
    const { $service, $helper } = app
    let r = await $service.routeService.getRoute()
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 获取ui权限
   * @returns {Promise<void>}
   */
  async getUiPermission (ctx) {
    const { $service, $helper, $model  } = app
    const { uiPermission } = $model
    let r = await $service.baseService.query(uiPermission, {status: 1})
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '查询失败！')
    }
  },

  async test (ctx) {
    const { $ws, $helper } = app
    // $ws.connections.forEach(function (conn) {
    //   // 前端刷新房间状态
    //   console.log(conn.path)
    //   if(conn.path==='/lrs/62bea9278be1b52b7f61e812'){
    //     conn.sendText('gameStart')
    //   }
    // })
    ctx.body = $helper.Result.success('ok')
  }

})
