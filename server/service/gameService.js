module.exports = app => ({

  /**
   * 获取可见的玩家信息
   * @returns {Promise<{result}>}
   */
  async getPlayerInfoInGame (ctx,id) {
    const { $service, $helper, $model, $constants } = app
    const { game, player, user, vision } = $model
    const { playerRoleMap } = $constants
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let currentUser = await $service.baseService.userInfo(ctx)
    let playerCount = gameInstance.playerCount || 9
    let playerInfo = []
    for(let i =0; i < playerCount; i++) {
      let un = gameInstance['v' + (i + 1)]
      // 查询其他玩家信息
      let otherPlayer = await $service.baseService.queryOne(player, {username: un, gameId: id, roomId: gameInstance.roomId})
      if(gameInstance.status === 2 || gameInstance.status === 3){
        // 如果游戏已经结束，则获取完全视野（复盘）
        playerInfo.push({
          name: otherPlayer.name,
          username: otherPlayer.username,
          isSelf: un === currentUser.username, // 是否是自己
          camp: otherPlayer.camp, // 是否知晓阵营
          campName: otherPlayer.camp === 1 ? '好人阵营' : '狼人阵营', // 是否知晓阵营
          status: otherPlayer.status, // 是否死亡
          role: otherPlayer.role, // 是否知晓角色
          roleName: playerRoleMap[otherPlayer.role] ? playerRoleMap[otherPlayer.role].name : '', // 是否知晓角色
          position: otherPlayer.position
        })
        continue
      }
      // 查询玩家信息
      let otherUser = await $service.baseService.queryOne(user, {username: otherPlayer.username})
      // 查询自己对该玩家的视野
      let visionInstance = await $service.baseService.queryOne(vision, {gameId: gameInstance._id, roomId: gameInstance.roomId, from: currentUser.username, to: un})
      playerInfo.push({
        name: otherUser.name,
        username: otherUser.username,
        isSelf: un === currentUser.username, // 是否是自己
        camp: visionInstance.status === 0 ? null : otherPlayer.camp, // 是否知晓阵营
        campName: visionInstance.status === 0 ? null : (otherPlayer.camp === 1 ? '好人阵营' : '狼人阵营'),
        status: otherPlayer.status, // 是否死亡
        role: visionInstance.status === 2 ? otherPlayer.role : null, // 是否知晓角色
        roleName: visionInstance.status === 2 ? (playerRoleMap[otherPlayer.role] ? playerRoleMap[otherPlayer.role].name : '') : null,
        position: otherPlayer.position
      })
    }
    return $helper.wrapResult(true, playerInfo)
  },

  /**
   * 获取当前玩家在游戏中的技能状态
   * @returns {Promise<{result}>}
   */
  async getSkillStatusInGame (ctx, id) {
    const { $service, $helper, $model } = app
    const { game, player, action } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let currentUser = await $service.baseService.userInfo(ctx)
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    if(!currentPlayer.skill || currentPlayer.skill.length < 1){
      return $helper.wrapResult(true, [])
    }
    let skill = currentPlayer.skill
    let tmp = []
    // 查询一下当天有没有救人或者毒人，只要有2之一，女巫当晚不能再使用技能
    let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 1, from: currentPlayer.username, action: 'check'})
    let assaultAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 2, from: currentPlayer.username, action: 'assault'})
    let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, from: currentPlayer.username, action: 'antidote'})
    let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, from: currentPlayer.username, action: 'poison'})
    let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, action: 'kill'})
    skill.forEach(item=>{
      if(item.key === 'boom'){
        // 自爆只有在发言阶段可用，且存活状态才可以使用
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: gameInstance.stage === 5 && currentPlayer.status === 1, // 是否可用
          show: gameInstance.stage === 5 && currentPlayer.status === 1, // 是否显示
        })
      } else if (item.key === 'assault') {
        // 袭击只有在夜晚狼人行动是可用，且存活状态，
        let useStatus = gameInstance.stage === 2 && currentPlayer.status === 1 && item.status === 1
        if(assaultAction){
          // 使用之后，不能再使用
          useStatus = false
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: useStatus, // 狼人袭击，夜晚、存活且可用
          show: gameInstance.stage === 2 && currentPlayer.status === 1 && item.status === 1, // (是否展示在前端)存活且轮到自己行动，所以预言家在狼人之前行动，避免刚好被刀（第一晚可报查验，之后用不用也无法开口了），导致当晚技能用不了
        })
      } else if (item.key === 'check') {
        let useStatus = gameInstance.stage === 1 && currentPlayer.status === 1 && item.status === 1
        if(checkAction){
          useStatus = false
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: useStatus , // 预言家查验，只要存活可一直使用
          show: gameInstance.stage === 1 && currentPlayer.status === 1 && item.status === 1, // (是否展示在前端)存活且轮到自己行动，所以预言家在狼人之前行动，避免刚好被刀（第一晚可报查验，之后用不用也无法开口了），导致当晚技能用不了
        })
      } else if (item.key === 'antidote') {
        let useStatus = gameInstance.stage === 3 && item.status === 1 && currentPlayer.status === 1
        if(saveAction){
          useStatus = false
        }
        if(poisonAction){
          useStatus = false
        }
        if(killAction && gameInstance.day !== 1){
          // 首页之后不能自救
          if(currentPlayer.username === killAction.to){
            useStatus = false
          }
        }
        if(!killAction){
          useStatus = false
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: useStatus,
          show: gameInstance.stage === 3 && currentPlayer.status === 1, // (是否展示在前端)存活且轮到自己行动
        })
      } else if (item.key === 'poison') {
        let useStatus = gameInstance.stage === 3 && item.status === 1 && currentPlayer.status === 1
        if(saveAction){
          useStatus = false
        }
        if(poisonAction){
          useStatus = false
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: useStatus,
          show: gameInstance.stage === 3 && currentPlayer.status === 1, // (是否展示在前端)存活且轮到自己行动
        })
      } else if (item.key === 'shoot') {
        const computeHunterSkill = (stage) => {
          if(item.status !== 1){
            return false
          }
          if(stage === 4 && currentPlayer.status === 0){
            // 经过了晚上的洗礼，如果死亡
            return currentPlayer.outReason !== 'poison'
          }
          return stage === 7 && currentPlayer.status === 0;
        }
        tmp.push({
          key: item.key,
          name: item.name,
          canUse: computeHunterSkill(gameInstance.stage), // 猎人晚上不死于毒药可开枪, 被投出去可开枪
          show: (gameInstance.stage === 4 || gameInstance.stage === 7) && item.status === 1, // 是否展示在前端
        })
      }
    })
    return $helper.wrapResult(true, tmp)
  },

  /**
   * 获取游戏公告信息
   * @returns {Promise<{result}>}
   */
  async getBroadcastInfo(ctx, id) {
    const { $service, $helper, $model, $constants } = app
    const { game, gameTag } = $model
    const { broadcastMap } = $constants
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    if(gameInstance.status === 2){
      let info = []
      info.push({text: '游戏结束！', level: 1})
      info.push({text: gameInstance.winner === 0 ? '狼人阵营' : '好人阵营', level: gameInstance.winner === 0 ? 2 : 3})
      info.push({text: '胜利！', level: 1})
      return $helper.wrapResult(true, info)
    }
    if(gameInstance.status === 3){
      let info = []
      info.push({text: '房主结束了该场游戏，游戏已', level: 1})
      info.push({text: '结束！', level: 2})
      return $helper.wrapResult(true, info)
    }
    if(gameInstance.stage === 0 && gameInstance.day === 1) {
      return $helper.wrapResult(true, broadcastMap['1-0'])
    }

    if(gameInstance.stage === 0) {
      return $helper.wrapResult(true, broadcastMap['*-0'])
    }

    if(gameInstance.stage === 1) {
      return $helper.wrapResult(true, broadcastMap['*-1'])
    }

    if(gameInstance.stage === 2){
      return $helper.wrapResult(true, broadcastMap['*-2'])
    }

    if(gameInstance.stage === 3){
      return $helper.wrapResult(true, broadcastMap['*-3'])
    }

    if(gameInstance.stage === 4){
      let diePlayer = await $service.baseService.query(gameTag, {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: { $in: [3, 4]}, // 阶段
        mode: 1
      }, {}, { sort: { position: 1}})
      if(!diePlayer || diePlayer.length < 1){
        let info = []
        info.push({text: '昨天晚上是', level: 1})
        info.push({text: '平安夜', level: 3})
        return $helper.wrapResult(true, info)
      } else {
        let dieString = ''
        let dieMap = {} // 去重，去掉狼人和女巫杀同一个人
        diePlayer.forEach((item,index)=>{
          if(dieMap[item.target]){
            return
          }
          dieMap[item.target] = item
          if(index !== 0){
            dieString = dieString + '和'
          }
          dieString = dieString + item.position + '号玩家（' + item.name + '）'
        })
        let info = []
        info.push({text: '昨天晚上死亡的是：', level: 1})
        info.push({text: dieString, level: 2})
        info.push({text: '，等待死亡玩家发动技能', level: 1})
        if(gameInstance.day === 1){
          // 第一天死亡有遗言
          info.push({text: '，且第一晚死亡有', level: 1})
          info.push({text: '遗言', level: 2})
        } else {
          info.push({text: '，没有', level: 1})
          info.push({text: '遗言', level: 2})
        }
        return $helper.wrapResult(true, info)
      }
    }

    if(gameInstance.stage === 5){
      let order = await $service.baseService.queryOne(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, mode: 2})
      let info = []
      info.push({text:'进入发言环节，从', level: 1})
      info.push({text: '' + order.position + '号玩家（' + order.name + '）', level:2})
      info.push({text:'开始发言，顺序为：', level: 1})
      info.push({text:order.value === 'asc' ? '正向' : '逆向', level: 2})
      return $helper.wrapResult(true, info)
    }

    if(gameInstance.stage === 6){
      return $helper.wrapResult(true, broadcastMap['*-6'])
    }

    if(gameInstance.stage === 7){
      let voteTag = await $service.baseService.queryOne(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage: 6, mode: 1})
      if(!voteTag){
        let info = []
        info.push({text:'平票，今天没有玩家出局，没有遗言', level: 1})
        return $helper.wrapResult(true, info)
      } else {
        let info = []
        info.push({text:'' + voteTag.position + '号玩家（' + voteTag.name + '）', level: 2})
        info.push({text:'被投票', level: 1})
        info.push({text:'出局', level: 2})
        info.push({text:'，等待玩家发动技能', level: 1})
        info.push({text:'，等待玩家发表遗言。', level: 1})
        return $helper.wrapResult(true, info)
      }
    }
    return $helper.wrapResult(true, [])
  },


  /**
   * 获取每个玩家独有的系统提示
   * @returns {Promise<{result}>}
   */
  async getSystemTips  (ctx, id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, action, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let currentUser = await $service.baseService.userInfo(ctx)
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    if(gameInstance.status === 2){
      let info = []
      info.push({text: '游戏结束！', level: 1})
      info.push({text: gameInstance.winner === 0 ? '狼人阵营' : '好人阵营', level: gameInstance.winner === 0 ? 2 : 3})
      info.push({text: '胜利！', level: 1})
      return $helper.wrapResult(true, info)
    }
    if(currentPlayer.role === 'predictor' && (gameInstance.stage === 1 || gameInstance.stage === 2 || gameInstance.stage === 3 || gameInstance.stage === 4 || gameInstance.stage === 4)){
      // 允许在投票前显示预言家当晚的查验信息
      let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 1, action: 'check'})
      if(!checkAction){
        if(gameInstance.stage === 1){
          return $helper.wrapResult(true, [])
        }
        let info = []
        info.push({text: '你', level: 1})
        info.push({text: '预言家', level: 3})
        info.push({text: '今晚没有查验玩家', level: 1})
        return $helper.wrapResult(true, info)
      }
      let checkUsername = checkAction.to
      let checkPlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: checkUsername})
      let info = []
      info.push({text: '你', level: 1})
      info.push({text: '预言家', level: 3})
      info.push({text: '今晚查验的玩家为', level: 1})
      info.push({text: $support.getPlayerFullName(checkPlayer), level: 2})
      info.push({text: '他的身份为', level: 1})
      info.push({text: checkPlayer.camp === 1 ? '好人阵营' : '狼人阵营', level: checkPlayer.camp === 1 ? 3 : 2})
      return $helper.wrapResult(true, info)
    } else if (gameInstance.stage === 2 && currentPlayer.role === 'wolf'){
      let assaultAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, from: currentPlayer.username, action: 'assault'})
      if(assaultAction && assaultAction.to){
        let assaultPlayer = await $service.baseService.queryOne(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, username: assaultAction.to})
        let info = []
        info.push({text: '你今晚袭击了', level: 1})
        info.push({text: $support.getPlayerFullName(assaultPlayer), level: 2})
        return $helper.wrapResult(true, info)
      } else {
        let info = []
        info.push({text: '请确认您的同伴，并讨论要袭击的玩家', level: 3})
        return $helper.wrapResult(true, info)
      }
      return $helper.wrapResult(true, [])
    } else if ((gameInstance.stage === 3 || gameInstance.stage === 4) && currentPlayer.role === 'wolf') {
      let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, action: 'kill'})
      if(!killAction){
        let info = []
        info.push({text: '你们', level: 1})
        info.push({text: '狼人团队', level: 2})
        info.push({text: '晚上没有袭击玩家', level: 1})
        return $helper.wrapResult(true, info)
      }
      let killUsername = killAction.to
      let killPlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: killUsername})
      let info = []
      info.push({text: '你们', level: 1})
      info.push({text: '狼人团队', level: 2})
      info.push({text: '晚上袭击了', level: 1})
      info.push({text: $support.getPlayerFullName(killPlayer), level: 3})
      return $helper.wrapResult(true, info)
    } else if ((gameInstance.stage === 3) && currentPlayer.role === 'witch') {
      let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, action: 'kill'})
      if(!killAction){
        let info = []
        info.push({text: '今晚没有玩家', level: 1})
        info.push({text: '死亡', level: 2})
        return $helper.wrapResult(true, info)
      }
      let dieUsername = killAction.to
      let diePlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: dieUsername})
      let currentSkills = currentPlayer.skill
      let antidoteSkill
      currentSkills.forEach(item=>{
        if(item.key === 'antidote'){
          antidoteSkill = item
        }
      })

      let info = []
      if(antidoteSkill && antidoteSkill.status === 1 && currentPlayer.status === 1){
        info.push({text: '昨晚死亡的是', level: 1})
        info.push({text: $support.getPlayerFullName(diePlayer), level: 2,})
        if(killAction.to === currentPlayer.username && gameInstance.day !== 1){
          info.push({text: '，女巫非首页不能自救，', level: 2,})
          info.push({text: '请选择是否使用', level: 1})
        } else {
          info.push({text: '，', level: 1})
          info.push({text: '请选择使用', level: 1})
          info.push({text: '解药', level: 3})
          info.push({text: '或者', level: 1})
        }
      }
      info.push({text: '使用', level: 1})
      info.push({text: '毒药', level: 2})
      info.push({text: '毒杀别的玩家', level: 1})

      let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
      if(saveAction){
        let savePlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: saveAction.to})
        info = []
        info.push({text: '昨晚死亡的是', level: 1})
        info.push({text: $support.getPlayerFullName(savePlayer), level: 2})
        info.push({text: '，你使用了', level: 1})
        info.push({text: '解药', level: 3})
        info.push({text: '救了', level: 1})
        info.push({text: $support.getPlayerFullName(savePlayer) , level: 3})
      }
      let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'poison'})
      if(poisonAction){
        let poisonPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: poisonAction.to})
        info = []
        info.push({text: '你使用了毒药毒死了', level: 1})
        info.push({text: $support.getPlayerFullName(poisonPlayer) , level: 2})
      }
      return $helper.wrapResult(true, info)
    } else if (gameInstance.stage === 4 && currentPlayer.role === 'hunter') {
      if(currentPlayer.status === 0){
        let info = []
        info.push({text: '你已', level: 1})
        info.push({text: '出局', level: 2})
        let skills = currentPlayer.skill
        let skill
        skills.forEach(item=>{
          if(item.key === 'shoot'){
            skill = item
            return
          }
        })
        if(skill && skill.status === 0){
          // 使用过技能了
          return $helper.wrapResult(true, info)
        }
        if(currentPlayer.outReason !== 'poison'){
          info.push({text: '，你现在可以发动', level: 1})
          info.push({text: '技能', level: 3})
        } else {
          info.push({text: '，你被', level: 1})
          info.push({text: '，毒药毒死，', level: 2})
          info.push({text: '无法发动技能', level: 1})
        }
        return $helper.wrapResult(true, info)
      }
    } else if (gameInstance.stage === 6){
      let voteAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 6, from: currentPlayer.username, action: 'vote'})
      if(voteAction && voteAction.to){
        let votePlayer = await $service.baseService.queryOne(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, username: voteAction.to})
        let info = []
        info.push({text: '你今天投票给', level: 1})
        info.push({text: $support.getPlayerFullName(votePlayer), level: 2})
        return $helper.wrapResult(true, info)
      }
      return $helper.wrapResult(true, [])
    }
    return $helper.wrapResult(true, [])
  },

  /**
   * 获取玩家在游戏中的动作状态
   * @returns {Promise<{result}>}
   */
  async getActionStatusInGame (ctx, id) {
    const { $service, $helper, $model } = app
    const { game, player, action } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let currentUser = await $service.baseService.userInfo(ctx)
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    let useStatus = gameInstance.stage === 6 && currentPlayer.status === 1
    let voteAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 6, from: currentPlayer.username, action: 'vote'})
    if(voteAction){
      // 您已经投过票了
      useStatus = false
    }
    let actions = [
      {
        key: 'vote',
        name: '投票',
        canUse: useStatus,
        show: gameInstance.stage === 6 && currentPlayer.status === 1,
      }
    ]
    return $helper.wrapResult(true, actions)
  },

  /**
   * 获取游戏是否结束
   * @returns {Promise<{result}>}
   */
  async settleGameOver (id) {
    const { $service, $helper, $model, $ws } = app
    const { game, player, record } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let villagerAlive = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, role: 'villager', status: 1})
    if(!villagerAlive || villagerAlive.length < 1){
      // 屠边 - 村民 => 游戏结束，狼人胜利
      await $service.baseService.updateById(game, gameInstance._id,{status: 2, winner: 0})
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'rich-text',
          content: [
            {
              text: '游戏结束！',
              level: 1,
            },
            {
              text: '狼人阵营',
              level: 2,
            },
            {
              text: '赢得',
              level: 1,
            },
            {
              text: '胜利！',
              level: 3,
            },
          ]
        }
      }
      await $service.baseService.save(record, recordObject)
      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + gameInstance.roomId
        if(conn.path === url){
          conn.sendText('gameOver')
        }
      })
      return $helper.wrapResult(true , 'Y')
    }

    let clericAlive = await $service.baseService.query(player,{
      gameId: gameInstance._id,
      roomId: gameInstance.roomId,
      role: { $in: ['predictor', 'witch', 'hunter']},
      status: 1
    })
    if(!clericAlive || clericAlive.length < 1){
      // 屠边 - 屠神 => 游戏结束，狼人胜利
      await $service.baseService.updateById(game, gameInstance._id,{status: 2, winner: 0})
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'rich-text',
          content: [
            {
              text: '游戏结束！',
              level: 1,
            },
            {
              text: '狼人阵营',
              level: 2,
            },
            {
              text: '赢得',
              level: 1,
            },
            {
              text: '胜利！',
              level: 3,
            },
          ]
        }
      }
      await $service.baseService.save(record, recordObject)
      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + gameInstance.roomId
        if(conn.path === url){
          conn.sendText('gameOver')
        }
      })
      return $helper.wrapResult(true , 'Y')
    }

    let wolfAlive = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, role: 'wolf', status: 1})
    if(!wolfAlive || wolfAlive.length < 1){
      // 狼人死完 => 游戏结束，好人胜利
      await $service.baseService.updateById(game, gameInstance._id,{status: 2, winner: 1})
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'rich-text',
          content: [
            {
              text: '游戏结束！',
              level: 1,
            },
            {
              text: '好人阵营',
              level: 3,
            },
            {
              text: '赢得',
              level: 1,
            },
            {
              text: '胜利！',
              level: 3,
            },
          ]
        }
      }
      await $service.baseService.save(record, recordObject)
      $ws.connections.forEach(function (conn) {
        let url = '/lrs/' + gameInstance.roomId
        if(conn.path === url){
          conn.sendText('gameOver')
        }
      })
      return $helper.wrapResult(true , 'Y')
    }
    // 游戏未结束
    return $helper.wrapResult(true , 'N')
  },

  /**
   * 进入下一个阶段
   * @param gameId
   * @returns {Promise<{result}>}
   */
  async moveToNextStage (gameId) {
    const { $service, $helper, $model, $support, $ws, $nodeCache } = app
    const { game, player, record, action, gameTag } = $model

    if(!gameId || gameId === ''){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }

    let gameInstance = await $service.baseService.queryById(game, gameId)

    let stage = gameInstance.stage
    let nextStage = stage + 1
    if(nextStage > 7) {
      // 进入第二天流程
      nextStage = 0
    }
    if( stage === 1){
      let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 1, action: 'check'})
      if(!checkAction) {
        // 空过
        let predictorPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, role: 'predictor'})
        let recordObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 0,
          isTitle: 0,
          content: {
            type: 'action',
            key: 'jump',
            text: $support.getPlayerFullName(predictorPlayer) + '，预言家空验',
            actionName: '空验',
            level: 6,
            from: {
              username: predictorPlayer.username,
              name: predictorPlayer.name,
              position: predictorPlayer.position,
              role: predictorPlayer.role,
              camp: predictorPlayer.camp,
              status: predictorPlayer.status
            },
            to: {
              username: null,
              name: null,
            }
          }
        }
        await $service.baseService.save(record, recordObject)
      }
    } else if(stage === 2){
      // 结算狼人的实际击杀目标
      let settleResult = await $service.stageService.wolfStage(gameInstance._id)
      if(!settleResult.result){
        return settleResult
      }
    } else if(stage === 3){
      // 结算女巫的操作结果
      let settleResult = await $service.stageService.witchStage(gameInstance._id)
      if(!settleResult.result){
        return settleResult
      }
      await $service.gameService.settleGameOver(gameInstance._id)
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
        content: {
          type: 'rich-text',
          content: [
            {
              text: '进入投票环节，由',
              level: 1,
            },
            {
              text: $support.getPlayerFullName(targetPlayer),
              level: 4,
            },
            {
              text: '开始发言。顺序为：',
              level: 1,
            },
            {
              text: randomOrder === 1 ? '正向' : '逆向',
              level: randomOrder === 1 ? 3 : 2,
            }
          ]
        }
      }
      await $service.baseService.save(record, recordObject)
    } else if (stage === 6) {
      // 投票 => 遗言 ,需要整理票型， 结算死亡玩家
      let voteActions = await $service.baseService.query(action, {roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage: 6, action: 'vote'})
      let alivePlayer = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, status: 1},{}, {sort: { position: 1 }})

      let voteResultMap = {}
      for(let i = 0; i < voteActions.length; i++){
        let item = voteActions[i]
        let from = item.from
        let to = item.to
        let fromPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: from})
        if(voteResultMap[to]){
          voteResultMap[to].push({username: from, position: fromPlayer.position})
        } else {
          voteResultMap[to] = [{username: from, position: fromPlayer.position}]
        }
      }

      // 找弃票玩家
      let abstainedPlayer = [] // 弃票玩家
      alivePlayer.forEach(item=>{
        let exist = voteActions.find(function (vote) {
          return vote.from === item.username
        })
        if(!exist){
          abstainedPlayer.push(item)
        }
      })

      for(let key in voteResultMap){
        let content = voteResultMap[key]
        // 排序
        content = content.sort(function (a,b){
          return a.position - b.position
        })
        let votePlayerString = ''
        let toPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: key})
        for(let i =0; i < content.length; i++){
          let fromPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: content[i].username})
          if(i !== 0){
            votePlayerString = votePlayerString + '、'
          }
          votePlayerString = votePlayerString + fromPlayer.position + '号'
        }
        let voteResultString = votePlayerString + '投票给了' + toPlayer.position + '号玩家（' + toPlayer.name + ')'
        let recordObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: {
            type: 'vote',
            actionName: '投票',
            text: voteResultString,
            action: 'vote',
            level: 4,
            from: {
              username: null,
              name: votePlayerString,
              position: null,
              role: null,
              camp: null
            },
            to: {
              username: toPlayer.username,
              name: toPlayer.position + '号（共' + content.length + '票）',
              position: toPlayer.position,
              role: null,
              camp: null
            }
          }
        }
        await $service.baseService.save(record, recordObject)
      }

      // 处理弃票record
      if(abstainedPlayer && abstainedPlayer.length > 0){
        let abstainedString = ''
        for(let i =0; i < abstainedPlayer.length; i++){
          if(i !== 0){
            abstainedString = abstainedString + '、'
          }
          abstainedString = abstainedString + abstainedPlayer[i].position + '号'
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
            type: 'vote',
            actionName: '弃票',
            text: abstainedString + '弃票',
            action: 'abstained',
            level: 5,
            from: {name: abstainedString},
            to: {
              name: '弃票',
              username: null
            }
          }
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
          content: {
            text: '所有人弃票，没有玩家出局',
            type: 'text',
            level: 2,
          }
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
            content: {
              text: '所有人弃票，没有玩家出局',
              type: 'text',
              level: 2,
            }
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
            content: {
              type: 'action',
              actionName: '放逐',
              action: 'out',
              text: $support.getPlayerFullName(votePlayer) + '获得最高票数，出局！',
              level: 2,
              from: {
                name: votePlayer.name,
                username: votePlayer.username,
                position: votePlayer.position,
                role: votePlayer.role,
                camp: votePlayer.camp
              },
              to: {
                role: 'exile',
                name: '放逐出局'
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
      await $service.gameService.settleGameOver(gameInstance._id)
    }

    let update = {stage: nextStage}
    if(nextStage === 0){
      update.day = gameInstance.day + 1
      let recordObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day + 1,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          text: '天黑请闭眼',
          type: 'text',
          level: 1,
        }
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

    // 倒计时 timer
    let updateGame = await $service.baseService.queryById(game, gameId)
    if(updateGame.stage === 1 || updateGame.stage === 2 || updateGame.stage === 3){
      // 预言家
      let t = updateGame.stage === 1 ? gameInstance.p1 : 30
      if(updateGame.stage === 2){
        t = gameInstance.p2 || 30
      }
      if(updateGame.stage === 3){
        t = gameInstance.p3 || 30
      }

      $nodeCache.set('game-time-' + gameInstance._id, t)
      app.timer = setInterval(function (){
        let time =  $nodeCache.get('game-time-' + gameInstance._id)
        if(time < 0){
          // 清掉定时器
          clearInterval(app.timer)
          $service.gameService.moveToNextStage(gameInstance._id)
        } else {
          $nodeCache.set('game-time-' + gameInstance._id, time - 1)
          let data = {
            'refreshGame': false,
            time: time,
          }
          $ws.connections.forEach(function (conn) {
            let url = '/lrs/' + gameInstance.roomId
            if(conn.path === url){
              conn.sendText(JSON.stringify(data))
            }
          })
        }
      },1000)
    } else {
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

    return $helper.wrapResult(true,'ok')
  }
})
