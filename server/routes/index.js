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
  router.get('/api/game/room/quit/auth', $middleware.auth, $controller.gameController.quitRoom)
  router.get('/api/game/room/modifyName/auth', $middleware.auth, $controller.gameController.modifyNameInRoom)
  router.get('/api/game/desk/seatIn/auth', $middleware.auth, $controller.gameController.seatIn)
  router.get('/api/game/room/kickPlayer/auth', $middleware.auth, $controller.gameController.kickPlayer)

  router.get('/api/game/start/auth', $middleware.auth, $controller.gameController.gameStart)
  router.get('/api/game/info/auth', $middleware.auth, $controller.gameController.getGameInfo)
  router.get('/api/game/nextStage/auth', $middleware.auth, $controller.gameController.nextStage)
  router.get('/api/game/userNextStage/auth', $middleware.auth, $controller.gameController.nextStage)
  router.get('/api/game/record/auth', $middleware.auth, $controller.gameController.commonGameRecord)
  router.get('/api/game/checkPlayer/auth', $middleware.auth, $controller.gameController.checkPlayer)
  router.get('/api/game/assaultPlayer/auth', $middleware.auth, $controller.gameController.assaultPlayer)
  router.get('/api/game/antidotePlayer/auth', $middleware.auth, $controller.gameController.antidotePlayer)
  router.get('/api/game/votePlayer/auth', $middleware.auth, $controller.gameController.votePlayer)
  router.get('/api/game/poisonPlayer/auth', $middleware.auth, $controller.gameController.poisonPlayer)

}
