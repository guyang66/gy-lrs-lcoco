module.exports = app => {
  const {router, $controller, $middleware} = app;

  // 登录
  router.post('/api/login', $controller.authController.login)

  // user相关
  router.get('/api/user/getUserInfo/auth', $middleware.auth, $controller.userController.getUserInfo)
  router.post('/api/user/create/auth', $middleware.auth, $controller.userController.createUser)

  // 后台配置接口
  router.get('/api/route/auth',$middleware.auth, $controller.configController.getRoute)
  router.get('/api/permission/ui/auth',$middleware.auth, $controller.configController.getUiPermission)

  router.get('/api/game/room/create/auth', $middleware.auth, $controller.gameController.createRoom)
  router.get('/api/game/room/info/auth', $middleware.auth, $controller.gameController.getRoomInfo)
  router.get('/api/game/room/join/auth', $middleware.auth, $controller.gameController.joinRoom)
  router.get('/api/game/desk/seatIn/auth', $middleware.auth, $controller.gameController.seatIn)

}
