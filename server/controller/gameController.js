module.exports = app => ({

  /**
   * 创建房间
   * @returns {Promise<void>}
   */
  async createRoom () {
    const { ctx, $service, $helper, $model } = app
    const { room } = $model
    const { roomName } = ctx.query
    if(!roomName || roomName === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }

    let currentUser = await $service.baseService.userInfo()
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

  async getRoomInfo () {
    const { ctx, $service, $helper, $model } = app
    const { room, user } = $model
    const { id } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'id不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, id)
    if(!roomInstance){
      ctx.body = $helper.Result.fail(-1, '当前房间已不存在！')
      return
    }
    if(roomInstance.status !== 0){
      // 只有准备中的房间才能获取房间信息，观战除外，一步一步来
      ctx.body = $helper.Result.fail(-1, '当前房间已在游戏中或已游戏结束！')
      return
    }
    let currentUser = await $service.baseService.userInfo()
    let username = currentUser.username
    let waitPlayer = roomInstance.wait

    // 是否已经入座
    let q = {
      "$and":
        [
          {_id: id},
          {
            "$or": [{"v1": username},{"v2": username},{"v3": username},{"v4": username},{"v5": username},{"v6": username},{"v7": username},{"v8": username},{"v9": username},]
          }
        ]
    }
    let isSeat =  await $service.baseService.queryOne(room,q)
    if(!isSeat){
      let exist = waitPlayer.find(p=>{
        return p === username
      })
      if(!exist){
        // 不再等待区，可能是通过url直接访问的
        ctx.body = $helper.Result.fail(-1, '你不在该房间内，请先退回首页，点击加入房间！')
        return
      }
    }

    let waitPlayerArray = []
    for(let i =0; i < roomInstance.wait.length; i ++){
      let item = roomInstance.wait[i]
      let player = await $service.baseService.queryOne(user, {username: item})
      if(player){
        waitPlayerArray.push({
          username: player.username,
          name: player.name
        })
      }
    }
    const getSeatInfo = async (key, index = 0) => {
      if(!roomInstance[key] || roomInstance[key] === ''){
        return {
          player: null,
          position: index + 1,
          name: (index + 1) + '号'
        }
      }
      let userInfo = await $service.baseService.queryOne(user, {username: roomInstance[key]}, {username: 1, name: 1})
      if(userInfo){
        return {
          player: userInfo,
          position: index + 1,
          name: (index + 1) + '号'
        }
      }
      return {
        player: null,
        position: index + 1,
        name: (index + 1) + '号'
      }
    }
    let allSeatInfo = []
    let seatStatus = 1
    for(let i = 0; i < 9; i++){
      let target = await getSeatInfo('v' + (i + 1), i)
      allSeatInfo.push(target)
      if(!target.player){
        // 如果有空位置，就不能开游戏！
        seatStatus = 0
      }
    }
    let model = {
      waitPlayer: waitPlayerArray,
      wait: roomInstance.wait,
      _id: roomInstance._id,
      name: roomInstance.name,
      password: roomInstance.password,
      status: roomInstance.status,
      seat: allSeatInfo,
      seatStatus: seatStatus,
    }
    ctx.body = $helper.Result.success(model)
  },

  /**
   * 入座
   * @returns {Promise<void>}
   */
  async seatIn () {
    const { ctx, $service, $helper, $model, $ws } = app
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
    let currentUser = await $service.baseService.userInfo()
    let username = currentUser.username
    let waitPlayer = roomInstance.wait
    let seatValue = roomInstance['v' + position]
    if(seatValue === username){
      // 当前位置坐的就是本人
      ctx.body = $helper.Result.success('ok')
      return
    }
    if(seatValue) {
      ctx.body = $helper.Result.fail(-1,'当前座位已经有人，请选择别的座位入座！')
      return
    }

    // 检查当前user是否在等待区（可能是观战user）
    let q = {
      "$and":
        [
          {_id: id},
          {
            "$or": [{"v1": username},{"v2": username},{"v3": username},{"v4": username},{"v5": username},{"v6": username},{"v7": username},{"v8": username},{"v9": username},]
          }
        ]
    }
    let isSeat =  await $service.baseService.queryOne(room,q)
    if(!isSeat){
      let exist = waitPlayer.find(p=>{
        return p === username
      })
      if(!exist){
        ctx.body = $helper.Result.fail(-1,'您不在等待区，请退出房间，重新加入该房间！')
        return
      }
    } else {
      // 已经入座了，找到入座了那个位置，直接清空
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
      if(waitPlayer[i] === username){

      } else {
        newWaitPlayer.push(waitPlayer[i])
      }
    }
    await $service.baseService.updateById(room, id, { wait: newWaitPlayer})
    $ws.connections.forEach(function (conn) {
      conn.sendText('refreshRoom')
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 加入房间
   * @returns {Promise<void>}
   */
  async joinRoom () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user } = $model
    const { key } = ctx.query
    if(!key || key === ''){
      ctx.body = $helper.Result.fail(-1,'房间密码不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryOne(room,{password: key})
    let currentUser = await $service.baseService.userInfo()
    let username = currentUser.username
    if(!roomInstance){
      ctx.body = $helper.Result.fail(-1,'房间不存在或密码不对！')
      return
    }
    if(roomInstance.status !== 0){
      let string = roomInstance.status === 1 ? '已开始，请尝试进入观战模式！' : '已结束！'
      ctx.body = $helper.Result.fail(-1,'游戏' + string)
      return
    }

    let q = {
      "$and":
        [
          {_id: roomInstance._id},
          {
            "$or": [{"v1": username},{"v2": username},{"v3": username},{"v4": username},{"v5": username},{"v6": username},{"v7": username},{"v8": username},{"v9": username},]
          }
        ]
    }
    let isSeat =  await $service.baseService.queryOne(room,q)
    if(!isSeat){
      // 如果不再座位上，则进入等待区
      let wait = roomInstance.wait
      wait.push(currentUser.username)
      await $service.baseService.updateById(room, roomInstance._id, {wait: wait})
    }

    $ws.connections.forEach(function (conn) {
      conn.sendText('refreshRoom')
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 退出房间
   * @returns {Promise<void>}
   */
  async quitRoom () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user } = $model
    const { id, username } = ctx.query
    console.log(id,username)
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let currentUser = await $service.baseService.userInfo()
    //todo: 验证是当前人在调用接口
    if(currentUser.username !== username){
      ctx.body = $helper.Result.fail(-1,'你不能操作别人账号退出房间！')
      return
    }
    //todo:时刻校验是不是当前房间的人在调用接口
    let roomInstance = await $service.baseService.queryById(room, id)

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
    for(let i =0; i < 9 ;i ++){
      let t = seatUpdate('v' + (i + 1))
      if(t){
        await $service.baseService.updateById(room, roomInstance._id, t)
      }
    }

    // 清除等待区的人

    let waitPlayer = roomInstance.wait
    let newWaitPlayer = []
    for(let i = 0; i < waitPlayer.length; i++){
      if(waitPlayer[i] === username){

      } else {
        newWaitPlayer.push(waitPlayer[i])
      }
    }
    await $service.baseService.updateById(room, id, { wait: newWaitPlayer})
    $ws.connections.forEach(function (conn) {
      conn.sendText('refreshRoom')
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 踢人
   * @returns {Promise<void>}
   */
  async kickPlayer () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room } = $model
    const { id, position } = ctx.query
    console.log(id,position)
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!position || position === ''){
      ctx.body = $helper.Result.fail(-1,'座位号不能为空！')
      return
    }
    //todo: 该房间是该房主创建才能t人
    let roomInstance = await $service.baseService.queryById(room, id)
    let currentUser = await $service.baseService.userInfo()
    let username = currentUser.username
    let updateObj = {}
    updateObj['v' + position] = null
    await $service.baseService.updateById(room, id, updateObj)
    $ws.connections.forEach(function (conn) {
      //todo:只能对应的频道发消息
      conn.sendText('refreshRoom')
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 在房间内修改昵称（需要通知到别人）
   * @returns {Promise<void>}
   */
  async modifyNameInRoom () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user } = $model
    const { id, name } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'userId不能为空！')
      return
    }
    if(!name || name === ''){
      ctx.body = $helper.Result.fail(-1,'新昵称不能为空！')
      return
    }
    let currentUser = await $service.baseService.userInfo()
    let targetUser = await $service.baseService.queryById(user, id)
    if(currentUser.username !== targetUser.username){
      ctx.body = $helper.Result.fail(-1,'你不能修改别人的信息')
      return
    }
    await $service.baseService.updateById(user, id, {name: name})
    $ws.connections.forEach(function (conn) {
      //todo:只能对应的频道发消息
      conn.sendText('refreshRoom')
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 开始游戏
   * @returns {Promise<void>}
   */
  async gameStart () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user } = $model
    const { id } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, id)
    let currentUser = await $service.baseService.userInfo()
    if(currentUser.defaultRole !== 'host'){
      ctx.body = $helper.Result.fail(-1,'只有房主角色才能开始游戏')
      return
    }
    if(roomInstance.owner !== currentUser.username){
      ctx.body = $helper.Result.fail(-1,'该房间不是你创建的，无法开始游戏！')
      return
    }
    let seatStatus = true
    const getSeatInfo = async (key, index = 0) => {
      if(!roomInstance[key] || roomInstance[key] === ''){
        return null
      }
      let userInfo = await $service.baseService.queryOne(user, {username: roomInstance[key]}, {username: 1, name: 1})
      if(userInfo){
        return userInfo
      }
      return null
    }
    for(let i = 0; i < 9; i++){
      let player = await getSeatInfo('v' + (i + 1), i)
      if(!player){
        // 如果有空位置，就不能开游戏！
        seatStatus = false
      }
    }
    if(!seatStatus){
      ctx.body = $helper.Result.fail(-1,'座位未做满，不满足游戏开始条件，请刷新页面！')
      return
    }

    // 开始游戏，创建一条游戏记录
    // todo: 怎么设计游戏
    // 游戏实例, 游戏信息   id、roomId、owner、状态（进行中、已结束）、阶段（第一天、第二天、、、）玩家参与者、
    // 玩家实例player id、roomId、gameId、 身份、阵营、死亡状态、技能状态、
    // 视野实例 ，   id、roomId、gameId、from：1号玩家  to：2号玩家   0:未知 1：知道阵容，2：完全知道身份
    // 记录：
    //
  }
})
