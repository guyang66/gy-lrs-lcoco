module.exports = app => ({

  /**
   * 开始游戏
   * @returns {Promise<void>}
   */
  async gameStart (ctx) {
    const { $service, $helper, $model, $constants, $support,$ws } = app
    const { room, game, user, player, vision, record } = $model
    const { gameModeMap, skillMap } = $constants
    let { id, setting } = ctx.request.body
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!setting){
      setting = {}
    }
    let roomInstance = await $service.baseService.queryById(room, id)
    let currentUser = await $service.baseService.userInfo(ctx)
    if(currentUser.defaultRole !== 'host'){
      ctx.body = $helper.Result.fail(-1,'只有房主角色才能开始游戏')
      return
    }
    if(roomInstance.owner !== currentUser.username){
      ctx.body = $helper.Result.fail(-1,'该房间不是你创建的，无法开始游戏！')
      return
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
    if(seatStatus === 0){
      ctx.body = $helper.Result.fail(-1,'座位未坐满，不满足游戏开始条件！')
      return
    }

    let gameObject = {
      roomId: roomInstance._id,
      owner: roomInstance.owner,
      status: 1,
      stage: 0, // 阶段
      day: 1, // 第一天
      v1: roomInstance.v1,
      v2: roomInstance.v2,
      v3: roomInstance.v3,
      v4: roomInstance.v4,
      v5: roomInstance.v5,
      v6: roomInstance.v6,
      v7: roomInstance.v7,
      v8: roomInstance.v8,
      v9: roomInstance.v9,
      playerCount: 9,
      p1: setting.p1 || 30,
      p2: setting.p2 || 45,
      p3: setting.p3 || 30,
      witchSaveSelf: setting.witchSaveSelf || 2,
      winCondition: setting.winCondition || 1,
      flatTicket: setting.flatTicket || 1,
      mode: 'standard_9' // 标准9人局
    }

    // 创建游戏实例
    let gameInstance = await $service.baseService.save(game, gameObject)

    // 随机创建player
    let mode = gameInstance.mode || 'standard_9'
    let playerCount = gameInstance.playerCount
    const standard9RoleArray = gameModeMap[mode]
    let randomPlayers = $helper.getRandomNumberArray(1, playerCount, playerCount, standard9RoleArray)
    for(let i =0; i < randomPlayers.length; i ++ ){
      let item = randomPlayers[i]
      let randomUser = await $service.baseService.queryOne(user,  {username: roomInstance['v' + (item.number)]})
      let p = {
        roomId: roomInstance._id,
        gameId: gameInstance._id,
        username: roomInstance['v' + (item.number)],
        name: randomUser.name,
        role: item.role,
        camp: item.role === 'wolf' ? 0 : 1, // 狼人阵营 ：0 ； 好人阵营：1
        status: 1, // 都是存活状态
        skill: skillMap[item.role],
        position: item.number
      }
      // 依次同步创建9个玩家
      await $service.baseService.save(player, p)
    }

    // 创建视野 0：完全未知，1：知晓阵营（一般预言家的视野），2：知晓角色(如狼人同伴)
    for(let i = 0 ; i < randomPlayers.length; i++){
      for(let j = 0 ; j < randomPlayers.length; j++){
        let v = {
          roomId: roomInstance._id,
          gameId: gameInstance._id,
          from: gameInstance['v' + randomPlayers[i].number],
          to: gameInstance['v' + randomPlayers[j].number],
          status: $support.getVisionKey(randomPlayers[i], randomPlayers[j])
        }
        // 创建9 x 9 = 81个视野
        await $service.baseService.save(vision, v)
      }
    }

    // 生产一条游戏开始记录
    let gameStartRecord = {
      roomId: roomInstance._id,
      gameId: gameInstance._id,
      content: {
        text: '游戏开始！',
        type: 'text',
        level: 2,
      },
      isCommon: 1,
      isTitle: 0
    }
    await $service.baseService.save(record, gameStartRecord)

    // 改变房间状态, 游戏进行中
    await $service.baseService.updateById(room, roomInstance._id,{ status: 1, gameId: gameInstance._id})

    // 游戏第一阶段记录
    let stageFirstRecord = {
      roomId: roomInstance._id,
      gameId: gameInstance._id,
      content: {
        text: '天黑请闭眼',
        type: 'text',
        level: 1,
      },
      isCommon: 1,
    }
    await $service.baseService.save(record, stageFirstRecord)

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('gameStart')
      }
    })
    ctx.body = $helper.Result.success('创建游戏成功！')
  },

  /**
   * 根据user获取游戏信息
   * @returns {Promise<void>}
   */
  async getGameInfo (ctx) {
    const { $service, $helper, $model, $constants } = app
    const { game, player } = $model
    const { playerRoleMap, stageMap } = $constants
    const { id } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'该游戏不存在！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!isOb && !currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }

    // 获取当前角色拥有的各个玩家的游戏信息
    let playerInfoResult = await $service.gameService.getPlayerInfoInGame(ctx, gameInstance._id)
    if(!playerInfoResult.result){
      ctx.body = $helper.Result.fail(playerInfoResult.errorCode, playerInfoResult.errorMessage)
      return
    }

    // 获取当前玩家的技能状态
    let skillInfo = await $service.gameService.getSkillStatusInGame(ctx, gameInstance._id)
    if(!skillInfo.result){
      ctx.body = $helper.Result.fail(skillInfo.errorCode, skillInfo.errorMessage)
      return
    }

    // 获取游戏公共信息
    let broadcastInfo = await $service.gameService.getBroadcastInfo(ctx, gameInstance._id)
    if(!broadcastInfo.result){
      ctx.body = $helper.Result.fail(broadcastInfo.errorCode, broadcastInfo.errorMessage)
      return
    }

    // 获取玩家的系统提示信息
    let systemTipsInfo = await $service.gameService.getSystemTips(ctx, gameInstance._id)
    if(!systemTipsInfo.result){
      ctx.body = $helper.Result.fail(systemTipsInfo.errorCode, systemTipsInfo.errorMessage)
      return
    }

    // 获取玩家的非角色技能状态（如投票）
    let actionInfo = await $service.gameService.getActionStatusInGame(ctx, gameInstance._id)
    if(!actionInfo.result){
      ctx.body = $helper.Result.fail(actionInfo.errorCode, actionInfo.errorMessage)
      return
    }

    let gameInfo = {
      _id: gameInstance._id,
      roomId: gameInstance.roomId,
      status: gameInstance.status,
      day: gameInstance.day,
      stage: gameInstance.stage,
      stageName: stageMap[gameInstance.stage] ? stageMap[gameInstance.stage].name : '未知',
      dayTag: gameInstance.stage < 4 ? '晚上' : '白天',
      roleInfo: isOb ? {} : {
        role: currentPlayer.role,
        roleName: (playerRoleMap[currentPlayer.role] ? playerRoleMap[currentPlayer.role].name : ''),
        skill: currentPlayer.skill,
        username: currentPlayer.username,
        name: currentUser.name,
        position:currentPlayer.position,
        status: currentPlayer.status,
        camp: currentPlayer.camp
      },
      playerInfo: playerInfoResult.data,
      skill: skillInfo.data,
      broadcast: broadcastInfo.data,
      systemTip: systemTipsInfo.data,
      action: actionInfo.data,
      winner: gameInstance.winner,
      isOb: isOb
    }
    ctx.body = $helper.Result.success(gameInfo)
  },

  /**
   * 进入下一阶段
   * role不存在的话，表示房主强制进行下一阶段
   * @returns {Promise<void>}
   */
  async nextStage (ctx) {
    const { $service, $helper, $model, $support, $nodeCache } = app
    const { game, player } = $model
    const { roomId, gameId, role } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    let currentUser = await $service.baseService.userInfo(ctx)

    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'

    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameId, username: currentUser.username})
    if(!isOb && !currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中！')
      return
    }
    if(role){
      /** 去掉玩家调用这个接口，采用倒计时，到点系统自动跳转到下一阶段 **/
      // role存在，说明是非host用户在调用接口，逻辑和host调用一样的，只不过多校验一下身份
      if(role !== currentPlayer.role){
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过！')
        return
      }
      if(currentPlayer.role === 'predictor' && gameInstance.stage !== 1){
        // 是预言家身份在调用接口，但是游戏中不是预言家的回合
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过（不是你的回合）！')
        return
      }
      if(currentPlayer.role === 'wolf' && gameInstance.stage !== 2){
        // 是狼人身份在调用接口，但是游戏中不是狼人的回合
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过（不是你的回合）！')
        return
      }
      if(currentPlayer.role === 'witch' && gameInstance.stage !== 3){
        // 是女巫身份在调用接口，但是游戏中不是女巫的回合
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过（不是你的回合）！')
        return
      }
      // 校验通过
    } else {
      // 如果role 不存在，host 在调用接口，校验一下是不是host身份
      if(currentUser.defaultRole !== 'host'){
        ctx.body = $helper.Result.fail(-1,'您不是房主，无权进行此操作！')
        return
      }
    }
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + $support.getGameWinner(gameInstance))
      return
    }
    if(gameInstance.status === 3){
      ctx.body = $helper.Result.fail(-1,'该局游戏已流局，请尝试重开游戏！')
      return
    }

    // 如果手动进入下一回合，需要清掉定时器
    if(app.$timer[gameInstance._id]){
      $nodeCache.set('game-time-' + gameInstance._id, -1)
      clearInterval(app.$timer[gameInstance._id])
    }
    await $helper.wait(200)

    let r = await $service.gameService.moveToNextStage(gameId)
    if(!r.result){
      ctx.body = $helper.Result.fail(r.errorCode, r.errorMessage)
      return
    }
    ctx.body = $helper.Result.success('操作成功！')
  },

  /**
   * 获取游戏公共事件记录
   * @returns {Promise<void>}
   */
  async commonGameRecord (ctx) {
    const { $service, $helper, $model} = app
    const { game, record } = $model
    const { roomId, gameId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }

    let currentUser = await $service.baseService.userInfo(ctx)
    let obResult = await $service.roomService.isOb(gameInstance.roomId, currentUser.username)
    let isOb = obResult.result && obResult.data === 'Y'

    let query = {roomId: roomId, gameId: gameId}
    if(gameInstance.status === 1 && !isOb){
      query.isCommon = 1
    }

    let recordList = await $service.baseService.query(record, query, {} , {sort: {id: -1}})
    let tagMap = {}

    // 游戏中只给部分信息，不影响游戏继续下去，隐藏掉关键的视野和角色信息
    // 游戏结束，给出完整游戏流程信息（属于复盘）
    const filterRecord = (record) => {

      const condition = (target, action) => {
        if(isOb){
          return false
        }
        if(action) {
          return gameInstance.status === 1 && target.role !== 'out' && target.role !== 'exile' && action !== 'shoot'
        } else {
          return gameInstance.status === 1 && target.role !== 'out' && target.role !== 'exile'
        }
      }

      if(record.content.type === 'action'){
        return Object.assign({},record,{
          content: {
            type: record.content.type,
            text: record.content.text,
            level: record.content.level,
            action: record.content.action,
            actionName: record.content.actionName,
            from: {
              username: record.content.from.username,
              name: record.content.from.name,
              position: record.content.from.position,
              status: record.content.from.status,
              role: condition(record.content.from, record.content.action) ? null : record.content.from.role,
              camp: condition(record.content.from, record.content.action) ? null : record.content.from.camp
            },
            to: {
              username: record.content.to.username,
              name: record.content.to.name,
              position: record.content.to.position,
              role: condition(record.content.to) ? null : record.content.to.role,
              camp: condition(record.content.to) ? null : record.content.to.camp
            }
          }
        })
      }
      return record
    }
    recordList.forEach(item=>{
      let day = item.day
      if(tagMap[day]){
        tagMap[day].content.push(filterRecord(item))
      } else {
        let c = []
        if(day !== 0){
          c.push({
            isTitle: 1,
            content: {
              text: '第' + day + '天',
              type: 'text',
              level: 1,
            }
          })
        }
        c.push(filterRecord(item))
        tagMap[day] = {
          key: day,
          content: c
        }
      }
    })
    ctx.body = $helper.Result.success(tagMap)
  },

  /**
   * 查验玩家
   * @returns {Promise<void>}
   */
  async checkPlayer (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { game, player, vision, record, action } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'predictor'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是预言家，无法使用该技能！')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }
    let visionInstance = await $service.baseService.queryOne(vision, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, to: username})
    if(visionInstance.status === 1){
      ctx.body = $helper.Result.fail(-1,'您已查验过该玩家的身份！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 1, action: 'check'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过查验功能！')
      return
    }
    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }
    // 修改视野
    await $service.baseService.updateById(vision, visionInstance._id, {status: 1})

    // 生成一条action
    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'check',
    }
    await $service.baseService.save(action, actionObject)

    let targetCamp = targetPlayer.camp
    let targetCampName = targetCamp === 1 ? '好人阵营' : '狼人阵营'
    // 生成一条record
    let recordObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 0,
      isTitle: 0,
      content: {
        type: 'action',
        text: '预言家：' + currentPlayer.position + '号玩家（' + currentPlayer.name + '）查验了' + targetPlayer.position + '号玩家（' + targetPlayer.name + '）的身份为：' + targetCampName,
        key: 'check',
        actionName: '查验',
        level: 3,
        from: {
          username: currentPlayer.username,
          name: currentPlayer.name,
          position: currentPlayer.position,
          role: currentPlayer.role,
          camp: currentPlayer.camp
        },
        to: {
          username: targetPlayer.username,
          name: targetPlayer.name,
          position: targetPlayer.position,
          role: targetPlayer.role,
          camp: targetPlayer.camp
        }
      }
    }
    await $service.baseService.save(record, recordObject)

    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
      camp: targetCamp,
      campName: targetCampName,
    }

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })

    ctx.body = $helper.Result.success(r)
  },

  /**
   * 狼人袭击玩家
   * @returns {Promise<void>}
   */
  async assaultPlayer (ctx) {
    const { $service, $helper, $model } = app
    const { game, player, action } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'wolf'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是狼人，无法使用该技能！')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 2, action: 'assault'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过袭击功能！')
      return
    }
    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }
    // 袭击不一定会真的造成死亡，还有可能被女巫救，所以要在天亮时结算。

    // 生成一条action
    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'assault',
    }
    await $service.baseService.save(action, actionObject)

    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 使用解药
   * @param ctx
   * @returns {Promise<void>}
   */
  async antidotePlayer (ctx) {
    const { $service, $helper, $model, $support } = app
    const { game, player, record, action } = $model
    const { roomId, gameId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'witch'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是女巫，无法使用该技能！')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }

    let skills = currentPlayer.skill
    let antidoteSkill
    skills.forEach(item=>{
      if(item.key === 'antidote'){
        antidoteSkill = item
      }
    })
    if(!antidoteSkill || antidoteSkill.status === 0){
      ctx.body = $helper.Result.fail(-1,'您当前状态不能使用该技能')
      return
    }

    let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: roomId, day: gameInstance.day, stage: 2, action: 'kill'})
    if(!killAction){
      ctx.body = $helper.Result.fail(-1,'当天没有玩家死亡，无需使用解药！')
      return
    }

    let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
    let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'poison'})
    if(saveAction || poisonAction){
      ctx.body = $helper.Result.fail(-1,'您已使用过该技能（解药）！')
      return
    }

    let killTarget = killAction.to
    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: killTarget,
      action: 'antidote',
    }
    await $service.baseService.save(action, actionObject)
    let diePlayer = await $service.baseService.queryOne(player,{roomId: roomId, gameId: gameInstance._id, username: killTarget})
    let recordObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 0,
      isTitle: 0,
      content: {
        type: 'action',
        key: 'antidote',
        text: '女巫——' + $support.getPlayerFullName(currentPlayer) + '使用解药救了：' +   $support.getPlayerFullName(diePlayer),
        actionName: '解药',
        level: 3,
        from: {
          username: currentPlayer.username,
          name: currentPlayer.name,
          position: currentPlayer.position,
          role: currentPlayer.role,
          camp: currentPlayer.camp
        },
        to: {
          username: diePlayer.username,
          name: diePlayer.name,
          position: diePlayer.position,
          role: diePlayer.role,
          camp: diePlayer.camp
        }
      },
    }
    await $service.baseService.save(record, recordObject)

    // 修改解药状态
    let newSkillStatus = []
    skills.forEach(item=>{
      if(item.key === 'antidote'){
        newSkillStatus.push({
          name: item.name,
          key: item.key,
          status: 0
        })
      } else {
        newSkillStatus.push(item)
      }
    })
    await $service.baseService.updateById(player, currentPlayer._id, {
      skill: newSkillStatus
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 投票
   * @returns {Promise<void>}
   */
  async votePlayer (ctx) {
    const { $service, $helper, $model } = app
    const { game, player, action } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }

    if(gameInstance.stage !== 6 && gameInstance.stage !== 6.5) {
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行投票操作')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 6, action: 'vote'})
    if(exist && gameInstance.stage === 6){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过投票功能！')
      return
    }
    if(gameInstance.flatTicket === 2){
      // 平票pk多出来的阶段
      let pkExist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 6.5, action: 'vote'})
      if(pkExist && gameInstance.stage === 6.5){
        ctx.body = $helper.Result.fail(-1,'今天你已使用过投票功能！')
        return
      }
    }

    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})

    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'vote',
    }
    await $service.baseService.save(action, actionObject)
    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 女巫撒毒
   * @returns {Promise<void>}
   */
  async poisonPlayer (ctx) {
    const { $service, $helper, $model } = app
    const { game, player, action } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    if(gameInstance.stage !== 3) {
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行毒药操作')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'witch'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是女巫，无法使用该技能！')
      return
    }
    if(currentPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'您已出局！，无法再使用该技能！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: 3, action: 'poison'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过毒药功能！')
      return
    }
    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }

    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'poison',
    }
    await $service.baseService.save(action, actionObject)
    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }
    //修改毒药状态
    let newSkillStatus = []
    let skills = currentPlayer.skill
    skills.forEach(item=>{
      if(item.key === 'poison'){
        newSkillStatus.push({
          name: item.name,
          key: item.key,
          status: 0
        })
      } else {
        newSkillStatus.push(item)
      }
    })
    await $service.baseService.updateById(player, currentPlayer._id, {
      skill: newSkillStatus
    })
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 猎人开枪
   * @param ctx
   * @returns {Promise<void>}
   */
  async shootPlayer (ctx) {
    const { $service, $helper, $model, $support, $ws } = app
    const { game, player, action, gameTag, record } = $model
    const { roomId, gameId, username } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    if(!username || username === ''){
      ctx.body = $helper.Result.fail(-1,'username不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    if(gameInstance.stage !== 4 && gameInstance.stage !== 7) {
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行开枪操作')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: {"$in": [4,7]}, action: 'shoot'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过开枪功能！')
      return
    }
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'hunter'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是猎人，无法使用该技能！')
      return
    }

    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }

    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: currentPlayer.username,
      to: targetPlayer.username,
      action: 'shoot',
    }
    await $service.baseService.save(action, actionObject)

    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }

    let recordObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: {
        type:'action',
        text: '猎人——' + $support.getPlayerFullName(currentPlayer) + '发动技能，开枪带走了'  + $support.getPlayerFullName(targetPlayer),
        action: 'shoot',
        actionName: '开枪',
        level: 2,
        from: {
          username: currentPlayer.username,
          name: currentPlayer.name,
          position: currentPlayer.position,
          role: currentPlayer.role,
          camp: currentPlayer.camp
        },
        to: {
          username: targetPlayer.username,
          name: targetPlayer.name,
          position: targetPlayer.position,
          role: targetPlayer.role,
          camp: targetPlayer.camp
        }
      }
    }
    await $service.baseService.save(record, recordObject)

    // 注册另一个玩家死亡
    let tagObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      dayStatus: gameInstance.stage < 4 ? 1 : 2,
      desc: 'shoot',
      mode: 1,
      target: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position
    }
    await $service.baseService.save(gameTag, tagObject)

    let deadRecord = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: {
        type: 'action',
        action: 'die',
        actionName: '死亡',
        level: 2,
        from: {
          username: targetPlayer.username,
          name: targetPlayer.name,
          position: targetPlayer.position,
          role: targetPlayer.role,
          camp: targetPlayer.camp
        },
        to: {
          role: 'out',
          name: '出局'
        }
      }
    }
    await $service.baseService.save(record, deadRecord)
    await $service.baseService.updateById(player, targetPlayer._id,{status: 0, outReason: 'shoot'})
    await $service.gameService.settleGameOver(gameInstance._id)

    let newSkillStatus = []
    let skills = currentPlayer.skill
    skills.forEach(item=>{
      if(item.key === 'shoot'){
        newSkillStatus.push({
          name: item.name,
          key: item.key,
          status: 0
        })
      } else {
        newSkillStatus.push(item)
      }
    })
    await $service.baseService.updateById(player, currentPlayer._id, {
      skill: newSkillStatus
    })

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success(r)
  },

  /**
   * 狼人自爆
   * @param ctx
   * @returns {Promise<void>}
   */
  async boomPlayer (ctx) {
    const { $service, $helper, $model, $support, $ws } = app
    const { game, player, action, gameTag, record } = $model
    const { roomId, gameId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status === 2){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    if(gameInstance.stage !== 5 ) {
      // 只能在发言阶段自爆
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行自爆操作')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }
    if(currentPlayer.role !== 'wolf'){
      ctx.body = $helper.Result.fail(-1,'您在游戏中的角色不是狼人，不能使用自爆技能！')
      return
    }

    let actionObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: currentPlayer.stage,
      from: currentPlayer.username,
      to: currentPlayer.username,
      action: 'boom',
    }
    await $service.baseService.save(action, actionObject)

    let recordObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: {
        type: 'action',
        text: $support.getPlayerFullName(currentPlayer) + '自爆！',
        action: 'boom',
        actionName: '自爆',
        level: 2,
        from: {
          username: currentPlayer.username,
          name: currentPlayer.name,
          position: currentPlayer.position,
          role: currentPlayer.role,
          camp: currentPlayer.camp
        },
        to: {
          name: '自爆',
          role: 'boom'
        }
      }
    }
    await $service.baseService.save(record, recordObject)
    // 注册死亡
    let tagObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      dayStatus: gameInstance.stage < 4 ? 1 : 2,
      desc: 'boom',
      mode: 1,
      target: currentPlayer.username,
      name: currentPlayer.name,
      position: currentPlayer.position
    }
    await $service.baseService.save(gameTag, tagObject)
    await $service.baseService.updateById(player, currentPlayer._id,{status: 0, outReason: 'boom'})
    let gameResult = await $service.gameService.settleGameOver(gameInstance._id)
    if(gameResult.result && gameResult.data === 'N'){
      // 游戏未结束，增加record
      let recordObjectNight = {
        roomId: roomId,
        gameId: gameInstance._id,
        day: gameInstance.day + 1,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          text: '天黑请闭眼。',
          type: 'text',
          level: 1
        }
      }
      await $service.baseService.save(record, recordObjectNight)

      // 修改阶段
      let update = {stage: 0, day: gameInstance.day + 1}
      await $service.baseService.updateById(game, gameInstance._id, update)
    }

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success(true)
  },

  /**
   * 游戏结果
   * @param ctx
   * @returns {Promise<void>}
   */
  async gameResult (ctx) {
    const { $service, $helper, $model} = app
    const { game} = $model
    const { id } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    if(gameInstance.status !== 2){
      ctx.body = $helper.Result.fail(-1,'游戏还在进行中或游戏异常！')
      return
    }
    let result = {
      winner: gameInstance.winner,
      winnerString:  gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
    }
    ctx.body = $helper.Result.success(result)
  },

  /**
   * 结束游戏（流局）
   * @param ctx
   * @returns {Promise<void>}
   */
  async gameDestroy (ctx) {
    const { $service, $helper, $model, $ws, $nodeCache } = app
    const { game, record, room } = $model
    const { roomId, gameId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, roomId)
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    if(currentUser.defaultRole !== 'host'){
      ctx.body = $helper.Result.fail(-1,'只有房主角色才能结束游戏')
      return
    }
    let update = {status: 3}
    await $service.baseService.updateById(game, gameInstance._id, update)

    let gameRecord = {
      roomId: roomInstance._id,
      gameId: gameInstance._id,
      content: '房主结束了该场游戏，游戏已结束！',
      isCommon: 1,
      isTitle: 0
    }
    await $service.baseService.save(record, gameRecord)

    if(app.$timer[gameInstance._id]){
      $nodeCache.set('game-time-' + gameInstance._id, -1)
      clearInterval(app.$timer[gameInstance._id])
      let data = {
        'refreshGame': false,
        time: 0,
      }
      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + gameInstance.roomId
        if(conn.path === url){
          conn.sendText(JSON.stringify(data))
        }
      })
    }

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 再来一局游戏
   * @param ctx
   * @returns {Promise<void>}
   */
  async gameAgain (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { room } = $model
    const { roomId } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    let roomInstance = await $service.baseService.queryById(room, roomId)
    if(!roomInstance){
      ctx.body = $helper.Result.fail(-1,'房间不存在！')
      return
    }

    // 重置掉当前局, 就是简单的清掉gameId即可
    let update = {
      status: 0,
      gameId: null
    }
    await $service.baseService.updateById(room, roomInstance._id, update)
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('reStart')
      }
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 观战
   * @returns {Promise<void>}
   */
  async obGame (ctx) {
    const { $service, $helper, $model, $ws } = app
    const { room, game, player } = $model
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
    if(!roomInstance.gameId){
      ctx.body = $helper.Result.fail(-1,'游戏尚未开始！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, roomInstance.gameId)
    if(gameInstance.status !== 1){
      ctx.body = $helper.Result.fail(-1,'游戏未开始或已结束，无法观战！')
      return
    }

    // todo: 架构问题，导致上下文只能通过函数传值，非常不友好，可以参考eggjs架构，用class以及懒加载实现动态获取上下文。
    let currentUser = await $service.baseService.userInfo(ctx)
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomInstance._id, gameId: roomInstance.gameId, username: currentUser.username})
    if(currentPlayer){
      ctx.body = $helper.Result.fail(-1,'你正在该局游戏中，不能进入观战模式')
      return
    }

    let obList = roomInstance.ob
    if(obList.includes(currentUser.username)){
      ctx.body = $helper.Result.success(roomInstance._id)
      return
    }
    obList.push(currentUser.username)
    await $service.baseService.updateById(room, roomInstance._id, {ob: obList})

    ctx.body = $helper.Result.success(roomInstance._id)
  }
})
