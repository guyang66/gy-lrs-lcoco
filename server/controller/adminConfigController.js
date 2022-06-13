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

  /**
   * 获取用户默认角色下的菜单
   * @returns {Promise<void>}
   */
  async getMenus() {
    const { ctx, $service, $helper } = app
    let r = await $service.adminMenuService.getAdminMenu()
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 获取路由列表
   * @returns {Promise<void>}
   */
  async getRoutelist () {
    const { ctx, $service, $helper } = app
    let { page, pageSize, searchKey, status } = ctx.request.body
    if(!page || page <= 0) {
      page = 1
    }
    if(!pageSize || pageSize < 0 ){
      pageSize = 10
    }
    let r = await $service.adminRouteService.getList( page, pageSize, { searchKey, status })
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 保存路由配置
   * @returns {Promise<void>}
   */
  async updateRoute () {
    const { ctx, $service, $helper, $model } = app
    const { adminRoute } = $model
    const { content, id } = ctx.request.body
    if(!id){
      ctx.body = $helper.Result.fail(-1,'参数有误（id不存在）！')
      return
    }

    if(!content){
      ctx.body = $helper.Result.fail(-1, '参数异常！')
      return
    }

    let r = await $service.baseService.update(id, content, adminRoute)
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '操作失败！')
    }
  },

  /**
   * 分页获取所有菜单
   * @returns {Promise<void>}
   */
  async getMenulist () {
    const { ctx, $service, $helper } = app
    let { page, pageSize, searchKey, orderSort, status, level } = ctx.request.body
    if(!page || page <= 0) {
      page = 1
    }
    if(!pageSize || pageSize < 0 ){
      pageSize = 10
    }
    let r = await $service.adminMenuService.getList( page, pageSize, { searchKey, orderSort, status, level })
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 保存菜单配置
   * @returns {Promise<void>}
   */
  async updateMenu () {
    const { ctx, $service, $helper, $model } = app
    const { adminMenu } = $model
    const { content, id } = ctx.request.body
    if(!id){
      ctx.body = $helper.Result.fail(-1,'参数有误（id不存在）！')
      return
    }

    if(!content){
      ctx.body = $helper.Result.fail(-1, '参数异常！')
      return
    }

    let r = await $service.baseService.update(id, content, adminMenu)
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '操作失败！')
    }
  },

  /**
   * 获取系统所有的角色
   * @returns {Promise<void>}
   */
  async getRoles () {
    const { ctx, $service, $helper, $model } = app
    const { role } = $model
    let r = await $service.baseService.query(role, {status: 1})

    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '查询失败！')
    }
  },


  async getUiPermission () {
    const { ctx, $service, $helper, $model  } = app
    const { componentPermission } = $model
    let r = await $service.baseService.query(componentPermission, {status: 1})
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '查询失败！')
    }
  },


})
