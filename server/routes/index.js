module.exports = app => {
  const {router, $controller, $middleware} = app;
  router.get('/base', $controller.baseController.find)
  router.get('/test', $controller.commonController.test)


  // 后台配置接口
  router.get('/api/route/auth',$middleware.auth, $controller.adminConfigController.getRoute)
  router.get('/api/menus/auth',$middleware.auth, $controller.adminConfigController.getMenus)
  router.get('/api/permission/ui/auth',$middleware.auth, $controller.adminConfigController.getUiPermission)
  router.get('/api/getRoles/auth',$middleware.auth, $controller.adminConfigController.getRoles)

  // 菜单
  router.post('/api/menu/list/auth', $middleware.auth, $controller.adminConfigController.getMenulist)

  // 路由
  router.post('/api/route/list/auth', $middleware.auth, $controller.adminConfigController.getRoutelist)

  // user相关
  router.get('/api/user/getUserInfo/auth', $middleware.auth, $controller.adminUserController.getUserInfo)

  // 登录
  router.post('/api/login', $controller.adminAuthController.login)
  // router.get('/api/getCaptcha', $controller.common.getCaptcha)

}
