module.exports = app => ({
  /**
   * 创建房间
   * @returns {Promise<void>}
   */
  async createRoom (ctx) {
    const { $service, $helper, $model } = app
    const { room } = $model
    const { roomName } = ctx.query
    if(!roomName || roomName === ''){
      ctx.body = $helper.Result.fail(-1,'房间名字不能为空！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let password = $helper.getRandomCode()
    let obj = {
      name: roomName,
      status: 0,
      password: password,
      owner: currentUser.username,
      wait: [currentUser.username]
    }
    let r = await $service.baseService.save(room, obj)
    if(r){
      ctx.body = $helper.Result.success(r)
    } else {
      ctx.body = $helper.Result.fail(-1, '创建房间失败！')
    }
  },

  /**
   * 获取房间信息
   * @returns {Promise<void>}
   */
  async getRoomInfo (ctx) {
    const { $service, $helper, $model } = app
    const { room, user } = $model
    const { id } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'房间id不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, id)
    if(!roomInstance){
      ctx.body = $helper.Result.fail(-1, '房间不存在！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let username = currentUser.username

    let obResult = await $service.roomService.isOb(roomInstance._id, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'

    let waitPlayer = roomInstance.wait

    // 判断当前用户是否已经入座
    let isSeat = await $service.roomService.findInSeatPlayer(id, username)
    if(!isOb && !isSeat.result){
      // 如果不在座位上，则查询是否在等待区
      let exist = waitPlayer.find(p=>{
        return p === username
      })
      if(!exist){
        // 不在座位上，也不在等待区，可能是通过url直接访问的
        ctx.body = $helper.Result.fail(-1, '你不在该房间内，请先返回首页，重新加入房间！')
        return
      }
    }

    let waitPlayerArray = []
    for(let i =0; i < roomInstance.wait.length; i++){
      let item = roomInstance.wait[i]
      let player = await $service.baseService.queryOne(user, {username: item})
      if(player){
        waitPlayerArray.push({
          username: player.username,
          name: player.name
        })
      }
    }

    let r = await $service.roomService.getRoomSeatPlayer(id)
    if(!r.result){
      ctx.body = $helper.Result.fail(r.errorCode, r.errorMessage)
      return
    }
    let seatInfo = r.data
    let seatStatus = 1
    seatInfo.forEach(item=>{
      if(!item.player){
        seatStatus = 0 // 座位未坐满人
      }
    })

    let model = {
      waitPlayer: waitPlayerArray,
      wait: roomInstance.wait,
      _id: roomInstance._id,
      name: roomInstance.name,
      password: roomInstance.password,
      status: roomInstance.status,
      seat: seatInfo, // 座位信息
      seatStatus: seatStatus, // 是否已做满,0:未坐满，1：已坐满（可开始游戏）
      gameId: roomInstance.gameId
    }
    ctx.body = $helper.Result.success(model)
  },

  /**
   * 加入房间
   * @returns {Promise<void>}
   */
  async joinRoom (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { room} = $model
    const { key } = ctx.query
    if(!key || key === ''){
      ctx.body = $helper.Result.fail(-1,'房间密码不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryOne(room,{password: key}, {} ,{sort: { createTime: -1 }})
    if(!roomInstance){
      ctx.body = $helper.Result.fail(-1,'房间不存在或密码不对！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let username = currentUser.username

    // 查看当前用户是否在座位上
    let isSeat = await $service.roomService.findInSeatPlayer(roomInstance._id, username)
    if(isSeat.result) {
      // 在座位上且游戏在进行中，则回复游戏状态即可。
      ctx.body = $helper.Result.success(roomInstance._id)
      return
    }

    let waitPlayer = roomInstance.wait
    let exist = waitPlayer.find(p=>{
      return p === username
    })
    if(!exist){
      let newWait = [...waitPlayer]
      newWait.push(currentUser.username)
      await $service.baseService.updateById(room, roomInstance._id, {wait: newWait})
    }

    if(roomInstance.status === 1){
      // 正在游戏中
      let string = roomInstance.status === 1 ? '已开始，请尝试进入观战模式！' : '已结束！'
      ctx.body = $helper.Result.fail(-1,'游戏' + string)
      return
    }

    $ws.connections.forEach(function (conn) {
      // 前端刷新房间状态
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('refreshRoom')
      }
    })

    ctx.body = $helper.Result.success(roomInstance._id)
  },

  /**
   * 退出房间
   * @returns {Promise<void>}
   */
  async quitRoom () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room } = $model
    const { id, username } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    if(currentUser.username !== username){
      ctx.body = $helper.Result.fail(-1,'你不能操作别人账号退出房间！')
      return
    }

    let roomInstance = await $service.baseService.queryById(room, id)
    if(roomInstance.status !== 0){
      // 游戏中或游戏结束，则可以随意退出，下次进来还是在游戏中
      ctx.body = $helper.Result.success(-1, '退出房间成功！')
      return
    }
    // 清除座位上的人
    const seatUpdate = (key) => {
      if(roomInstance[key] === username){
        // 需要被更新
        let obj = {}
        obj[key] = null
        return obj
      }
      return false
    }
    let seatCount = roomInstance.count || 9
    for(let i = 0; i < seatCount ;i ++){
      let t = seatUpdate('v' + (i + 1))
      if(t){
        await $service.baseService.updateById(room, roomInstance._id, t)
      }
    }

    // 清空等待区的人
    let waitPlayer = roomInstance.wait
    let newWaitPlayer = []
    for(let i = 0; i < waitPlayer.length; i++){
      if(waitPlayer[i] !== username){
        newWaitPlayer.push(waitPlayer[i])
      }
    }
    await $service.baseService.updateById(room, id, { wait: newWaitPlayer})
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('refreshRoom')
      }
    })
    ctx.body = $helper.Result.success('退出房间成功')
  },

  /**
   * 在房间内修改昵称（需要通知到别人）
   * @returns {Promise<void>}
   */
  async modifyPlayerNameInRoom (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { user, room } = $model
    const { id, roomId, name } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'userId不能为空！')
      return
    }
    if(!name || name === ''){
      ctx.body = $helper.Result.fail(-1,'新昵称不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, roomId)
    let currentUser = await $service.baseService.userInfo(ctx)
    let targetUser = await $service.baseService.queryById(user, id)
    if(currentUser.username !== targetUser.username){
      ctx.body = $helper.Result.fail(-1,'你不能修改别人的信息')
      return
    }

    await $service.baseService.updateById(user, id, {name: name})
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('refreshRoom')
      }
    })
    ctx.body = $helper.Result.success('修改成功')
  },

  /**
   * 房主踢人
   * @returns {Promise<void>}
   */
  async kickPlayer (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { room } = $model
    const { id, position } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!position || position === ''){
      ctx.body = $helper.Result.fail(-1,'座位号不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, id)
    let currentUser = await $service.baseService.userInfo(ctx)
    if(roomInstance.owner !== currentUser.username){
      ctx.body = $helper.Result.fail(-1,'你不是该房间的房主，无法踢人！')
      return
    }
    let updateObj = {}
    updateObj['v' + position] = null
    await $service.baseService.updateById(room, id, updateObj)
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('refreshRoom')
      }
    })
    ctx.body = $helper.Result.success('踢人成功！')
  },

  /**
   * 玩家入座
   * @returns {Promise<void>}
   */
  async sitDown (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { room } = $model
    const { id, position } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!position || position === ''){
      ctx.body = $helper.Result.fail(-1,'座位号不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, id)
    let currentUser = await $service.baseService.userInfo(ctx)
    let username = currentUser.username
    let seatValue = roomInstance['v' + position]
    if(seatValue === username){
      // 当前位置坐的就是本人,不用处理
      ctx.body = $helper.Result.success('入座成功')
      return
    }
    if(seatValue) {
      ctx.body = $helper.Result.fail(-1,'当前座位已经有人，请选择别的座位入座！')
      return
    }

    // 判断是否已经入座
    let isSeat =  await $service.roomService.findInSeatPlayer(id, username)
    let waitPlayer = roomInstance.wait
    if(!isSeat.result){
      let exist = waitPlayer.find(p=>{
        return p === username
      })
      if(!exist){
        ctx.body = $helper.Result.fail(-1,'您不在等待区，请退出房间，重新加入该房间！')
        return
      }
    } else {
      // 已经入座了，入座前需要退出座位
      const seatUpdate = (key) => {
        if(roomInstance[key] === username){
          // 需要被更新
          let obj = {}
          obj[key] = null
          return obj
        }
        return false
      }
      for(let i =0; i < 9 ;i ++){
        let t = seatUpdate('v' + (i + 1))
        if(t){
          await $service.baseService.updateById(room, roomInstance._id, t)
        }
      }
    }

    // 准备入座
    let updateObj = {}
    updateObj['v' + position] = username
    await $service.baseService.updateById(room, id, updateObj)

    // 清掉等待区的当前user
    let newWaitPlayer = []
    for(let i = 0; i < waitPlayer.length; i++){
      if(waitPlayer[i] !== username){
        newWaitPlayer.push(waitPlayer[i])
      }
    }
    await $service.baseService.updateById(room, id, { wait: newWaitPlayer})
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('refreshRoom')
      }
    })
    ctx.body = $helper.Result.success('入座成功')
  },

})
