module.exports = app => ({

  /**
   * 开始游戏
   * @returns {Promise<void>}
   */
  async gameStart (ctx) {
    const { $service, $helper, $model, $constants, $support,$ws } = app
    const { room, game, user, player, vision, record } = $model
    const { gameModeMap, skillMap } = $constants
    const { id } = ctx.query
    if(!id || id === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
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
      ctx.body = $helper.Result.fail(-1,'座位未做满，不满足游戏开始条件！')
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
      content: '游戏开始！',
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
      content: '天黑请闭眼。',
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
    const { game, player} = $model
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
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer){
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
      roleInfo: {
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
      winner: gameInstance.winner
    }
    ctx.body = $helper.Result.success(gameInfo)
  },

  /**
   * 进入下一阶段
   * ctx.query.role不存在的话，表示房主强制进行下一阶段
   * @returns {Promise<void>}
   */
  async nextStage (ctx) {
    const { $service, $helper, $model, $support, $ws } = app
    const { game, player, record, action, gameTag } = $model
    const { roomId, gameId, role } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let currentUser = await $service.baseService.userInfo(ctx)
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameId, username: currentUser.username})
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(role){
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
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过（不是你的回合）！')
        return
      }
      if(currentPlayer.role === 'witch' && gameInstance.stage !== 3){
        ctx.body = $helper.Result.fail(-1,'role身份前后端校验不通过（不是你的回合）！')
        return
      }
      // 校验通过
    } else {
      // 如果role 不存在，host 在调用接口，校验一下是不是host身份
      if(currentUser.defaultRole !== 'host'){
        ctx.body = $helper.Result.fail(-1,'请不是房主，无权进行此操作！')
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
    let stage = gameInstance.stage
    let nextStage = stage + 1
    if(nextStage > 7) {
      // 进入第二天流程
      nextStage = 0
    }
    if(stage === 2){
      // 结算狼人的实际击杀目标
      let settleResult = await $service.stageService.wolfStage(gameInstance._id)
      if(!settleResult.result){
        ctx.body = $helper.Result.fail(settleResult.errorCode, settleResult.errorMessage)
        return
      }
    } else if(stage === 3){
      // 结算女巫的操作结果
      let settleResult = await $service.stageService.witchStage(gameInstance._id)
      if(!settleResult.result){
        ctx.body = $helper.Result.fail(settleResult.errorCode, settleResult.errorMessage)
        return
      }
      await $service.gameService.settleGameOver(ctx, gameInstance._id)
    } else if (stage === 4) {
      // 天亮 => 发言环节
      let alivePlayer = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, status: 1})
      let randomPosition = Math.floor(Math.random() * alivePlayer.length )
      let randomOrder = Math.floor(Math.random() * 2 ) + 1 // 1到2的随机数
      let targetPlayer = alivePlayer[randomPosition]
      let tagObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        dayStatus: gameInstance.stage < 4 ? 1 : 2,
        desc: 'speakOrder',
        mode: 2,
        value: randomOrder === 1 ? 'asc' : ' desc', // asc 上升（正序） ; desc 下降（逆序）
        target: targetPlayer.username,
        name: targetPlayer.name,
        position: targetPlayer.position
      }
      await $service.baseService.save(gameTag, tagObject)
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: '进入投票环节，由' + targetPlayer.position + '号玩家（' + targetPlayer.name + '）开始发言。顺序为：' + (randomOrder === 1 ? '正向' : '逆向')
      }
      await $service.baseService.save(record, recordObject)
    } else if (stage === 6) {
      // 投票 => 遗言 ,需要整理票型， 结算死亡玩家
      let voteActions = await $service.baseService.query(action, {roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage: 6, action: 'vote'})

      let voteResultMap = {}
      voteActions.forEach(item=>{
        let from = item.from
        let to = item.to
        if(voteResultMap[to]){
          voteResultMap[to].push(from)
        } else {
          voteResultMap[to] = [from]
        }
      })
      for(let key in voteResultMap){
        let content = voteResultMap[key]
        let voteResultString = ''
        let toPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: key})
        for(let i =0; i < content.length; i++){
          let fromPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: content[i]})
          if(i !== 0){
            voteResultString = voteResultString + '、'
          }
          voteResultString = voteResultString + fromPlayer.position + '号玩家（' + fromPlayer.name + ')'
        }
        voteResultString = voteResultString + '投票给了' + toPlayer.position + '号玩家（' + toPlayer.name + '),共' + content.length + '票'
        let recordObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: voteResultString
        }
        await $service.baseService.save(record, recordObject)
      }

      if(!voteActions || voteActions.length < 1){
        let recordObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: '所有人弃票，没有玩家出局'
        }
        await $service.baseService.save(record, recordObject)
      } else {
        let usernameList = []
        voteActions.forEach(item=>{
          usernameList.push(item.to)
        })
        let maxCount = $helper.findMaxValue(usernameList)
        if(maxCount.length < 1){
          let recordObject = {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: gameInstance.stage,
            view: [],
            isCommon: 1,
            isTitle: 0,
            content: '所有人弃票，没有玩家出局'
          }
          await $service.baseService.save(record, recordObject)
        } else if(maxCount.length ===  1){
          let max = maxCount[0]
          let votePlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: max})
          let recordObject = {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: gameInstance.stage,
            view: [],
            isCommon: 1,
            isTitle: 0,
            content:  '' + votePlayer.position + '号玩家（' + votePlayer.name + '）获得最高票数，出局！'
          }
          await $service.baseService.save(record, recordObject)

          // 注册死亡
          let tagObject = {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: gameInstance.stage,
            dayStatus: gameInstance.stage < 4 ? 1 : 2,
            desc: 'vote',
            mode: 1,
            target: votePlayer.username,
            name: votePlayer.name,
            position: votePlayer.position
          }
          await $service.baseService.save(gameTag, tagObject)
          await $service.baseService.updateById(player, votePlayer._id,{status: 0, outReason: 'vote'})
          if(votePlayer.role === 'hunter'){
            // 修改猎人的技能状态
            let skills = votePlayer.skill
            let newSkillStatus = []
            skills.forEach(item=>{
              if(item.key === 'shoot'){
                newSkillStatus.push({
                  name: item.name,
                  key: item.key,
                  status: 1
                })
              } else {
                newSkillStatus.push(item)
              }
            })
            await $service.baseService.updateById(player, votePlayer._id, {
              skill: newSkillStatus
            })
          }
        } else {
          let recordObject = {
            roomId: gameInstance.roomId,
            gameId: gameInstance._id,
            day: gameInstance.day,
            stage: gameInstance.stage,
            view: [],
            isCommon: 1,
            isTitle: 0,
            content: '平票，没有玩家出局'
          }
          await $service.baseService.save(record, recordObject)
        }
      }
      await $service.gameService.settleGameOver(ctx, gameInstance._id)
    }

    let update = {stage: nextStage}
    if(nextStage === 0){
      update.day = gameInstance.day + 1

      let recordObject = {
        roomId: roomId,
        gameId: gameInstance._id,
        day: gameInstance.day + 1,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: '天黑请闭眼。'
      }
      await $service.baseService.save(record, recordObject)
    }
    await $service.baseService.updateById(game, gameInstance._id, update)
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
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
    let query = {roomId: roomId, gameId: gameId}
    if(gameInstance.status === 1){
      query.isCommon = 1
    }
    let recordList = await $service.baseService.query(record, query,{},{sort: {id: -1}})
    let tagMap = {}
    recordList.forEach(item=>{
      let day = item.day
      if(tagMap[day]){
        tagMap[day].content.push(item)
      } else {
        let c = []
        if(day !== 0){
          c.push({
            isTitle: 1,
            content: '第' + day + '天'
          })
        }
        c.push(item)
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
      ctx.body = $helper.Result.fail(-1,'您已查验并知晓该玩家的身份！')
      return
    }

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: gameInstance.stage, action: 'check'})
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
      // 'assault': '狼人袭击' , 'check': '预言家查验', 'antidote':女巫解药, 'poison':'女巫毒药', 'shoot': '猎人开枪'，'boom'：狼人自爆；'vote': '投票流放'
      action: 'check',
    }
    await $service.baseService.save(action, actionObject)

    // 修改预言家的skill为不能使用，等下一个天黑再变为可使用。
    // await $service.baseService.updateById(player, currentPlayer._id, {
    //   skill: [
    //     {
    //       "name" : "查验",
    //       "key" : "check",
    //       "status" : 0
    //     }
    //   ]
    // })

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
      content: '预言家：' + currentPlayer.position + '号玩家（' + currentPlayer.name + '）查验了' + targetPlayer.position + '号玩家（' + targetPlayer.name + '）的身份为：' + targetCampName
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

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: gameInstance.stage, action: 'assault'})
    if(exist){
      ctx.body = $helper.Result.fail(-1,'今天你已使用过袭击功能！')
      return
    }
    let targetPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameInstance._id, username: username})
    if(targetPlayer.status === 0){
      ctx.body = $helper.Result.fail(-1,'该玩家已出局！')
      return
    }
    // 袭击不一定会真的造成死亡。

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
      content: '女巫——' + $support.getPlayerFullName(currentPlayer) + '使用解药救了：' +   $support.getPlayerFullName(diePlayer)
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
    if(gameInstance.stage !== 6) {
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
   * 撒毒
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

    let exist = await $service.baseService.queryOne(action, {roomId: roomId, gameId: gameInstance._id, from: currentUser.username, day: gameInstance.day, stage: gameInstance.stage, action: 'poison'})
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

    // todo: 不能在这个阶段判死玩家，不然刷新状态就知道了，得在3~4阶段判定

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
   * 开枪
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
      content: '猎人——' + $support.getPlayerFullName(currentPlayer) + '发动技能，开枪带走了'  + $support.getPlayerFullName(targetPlayer)
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
    await $service.baseService.updateById(player, targetPlayer._id,{status: 0, outReason: 'shoot'})
    await $service.gameService.settleGameOver(ctx, gameInstance._id)

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
      ctx.body = $helper.Result.fail(-1,'该阶段不能进行开枪操作')
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
      content:  $support.getPlayerFullName(currentPlayer) + '自爆！'
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
    // 判断游戏结束没有 todo: 游戏结束还有后续流程没走完
    await $service.gameService.settleGameOver(ctx, gameInstance._id)

    // 增加record
    let recordObjectNight = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day + 1,
      stage: gameInstance.stage,
      view: [],
      isCommon: 1,
      isTitle: 0,
      content: '天黑请闭眼。'
    }
    await $service.baseService.save(record, recordObjectNight)

    // 修改阶段
    let update = {stage: 0, day: gameInstance.day + 1}
    await $service.baseService.updateById(game, gameInstance._id, update)

    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success(true)
  },

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


  async gameDestroy (ctx) {
    const { $service, $helper, $model, $ws } = app
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
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + gameInstance.roomId
      if(conn.path === url){
        conn.sendText('refreshGame')
      }
    })
    ctx.body = $helper.Result.success('ok')
  },

  async gameAgain (ctx) {
    const { $service, $helper, $model, $ws } = app
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
    if(!roomInstance){
      ctx.body = $helper.Result.fail(-1,'房间不存在！')
      return
    }
    let gameInstance = await $service.baseService.queryById(game, gameId)
    if(!gameInstance){
      ctx.body = $helper.Result.fail(-1,'游戏不存在！')
      return
    }

    // 重置掉当前局
    let update = {
      status: 0,
      gameId: null
    }
    await $service.baseService.updateById(room, roomInstance._id,update)
    $ws.connections.forEach(function (conn) {
      let url = '/lrs/' + roomInstance._id
      if(conn.path === url){
        conn.sendText('reStart')
      }
    })
    ctx.body = $helper.Result.success('ok')
  }

})
