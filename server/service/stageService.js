module.exports = app => ({

  /**
   * 狼人行动结束后的结算 —— 计算被刀次数最后的玩家作为狼人夜晚击杀的目标
   * @param id
   * @returns {Promise<{result}>}
   */
  async wolfStage(id) {
    const { $service, $helper, $model, $support } = app
    const { game, player,action,record } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let assaultActionList = await $service.baseService.query(action, {roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage: 2, action: 'assault'})
    if(!assaultActionList || assaultActionList.length < 1){
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
          text: '狼人空刀',
          actionName: '空刀',
          level: 5,
          from: {
            username: null,
            name: '狼人',
            position: null,
            role: 'wolf',
            camp: 0
          },
          to: {
            username: null,
            name: null,
          }
        }
      }
      await $service.baseService.save(record, recordObject)
      return $helper.wrapResult(true, '')
    }

    // 计算袭击真正需要死亡的玩家，票数多的玩家死亡，平票则随机抽选一个死亡
    let usernameList = []
    assaultActionList.forEach(item=>{
      usernameList.push(item.to)
    })
    // 找到他们中被杀次数最多的
    let target = $helper.findMaxInArray(usernameList)
    let actionObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      from: 'wolf',
      to: target,
      action: 'kill',
    }
    await $service.baseService.save(action, actionObject)
    let diePlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: target})
    let recordObject = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 0,
      isTitle: 0,
      content: {
        text: '狼人今晚袭击了：' + $support.getPlayerFullName(diePlayer),
        type: 'action',
        key: 'kill',
        actionName: '袭击',
        level: 2,
        from: {
          username: null,
          name: '狼人',
          position: null,
          role: 'wolf',
          camp: 0,
        },
        to: {
          username: diePlayer.username,
          name: diePlayer.name,
          position: diePlayer.position,
          role: diePlayer.role,
          camp: diePlayer.camp,
        }
      }
    }
    await $service.baseService.save(record, recordObject)
    return $helper.wrapResult(true, '')
  },

  /**
   * 女巫行动后的结算
   * @param id
   * @returns {Promise<{result}>}
   */
  async witchStage (id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, action, record, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    // 女巫回合 => 天亮了, 需要结算死亡玩家和游戏是否结束
    let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 2, action: 'kill'})
    let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
    if(killAction && killAction.to){
      let killTarget = killAction.to
      let killPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: killTarget})
      if(!saveAction){
        // 女巫没有救人，不管他是没有使用技能，还是没有解药, 注定死亡一个
        let tagObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          dayStatus: gameInstance.stage < 4 ? 1 : 2,
          desc: 'assault',
          mode: 1,
          target: killPlayer.username,
          name: killPlayer.name,
          position: killPlayer.position
        }
        await $service.baseService.save(gameTag, tagObject)
        // 注册该玩家的死亡
        await $service.baseService.updateOne(player,{ roomId: gameInstance.roomId, gameId: gameInstance._id, username: killPlayer.username}, { status: 0 , outReason: 'assault'})
        if(killPlayer.role === 'hunter'){
          // 修改它的技能状态
          let skills = killPlayer.skill
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
          await $service.baseService.updateById(player, killPlayer._id, {
            skill: newSkillStatus
          })
        }
      }
      // 女巫救人，在女巫使用技能时结算。
    }

    // 结算女巫毒
    // 注意：不能在女巫用毒后就注册玩家的死亡，会造成还在女巫回合，就能看到谁已经死亡了(这样就知道死亡的玩家是被毒死)，需要滞后
    let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'poison'})
    if(poisonAction && poisonAction.to){
      let poisonPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: poisonAction.to})
      let witchPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: poisonAction.from})
      // 注册玩家死亡
      await $service.baseService.updateById(player, poisonPlayer._id,{status: 0, outReason: 'poison'})
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
          key: 'poison',
          text: $support.getPlayerFullName(witchPlayer) + '使用毒药毒死了' + $support.getPlayerFullName(poisonPlayer),
          actionName: '毒药',
          level: 2,
          from: {
            username: witchPlayer.username,
            name: witchPlayer.name,
            position: witchPlayer.position,
            role: witchPlayer.role,
            camp: witchPlayer.camp
          },
          to: {
            username: poisonPlayer.username,
            name: poisonPlayer.name,
            position: poisonPlayer.position,
            role: poisonPlayer.role,
            camp: poisonPlayer.camp
          }
        }
      }
      await $service.baseService.save(record, recordObject)

      let tagObject = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        dayStatus: gameInstance.stage < 4 ? 1 : 2,
        desc: 'poison',
        mode: 1,
        target: poisonPlayer.username,
        name: poisonPlayer.name,
        position: poisonPlayer.position
      }
      await $service.baseService.save(gameTag, tagObject)
    }

    if(!saveAction && !poisonAction){
      // 空过,找女巫
      let witchPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, role: 'witch'})

      // 查女巫的技能
      let skill = witchPlayer.skill
      let has = false
      skill.forEach(item=>{
        if(item.status === 1){
          has = true
        }
      })
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
          text: $support.getPlayerFullName(witchPlayer) + '，女巫空过',
          actionName: has ? '空过' : '药已用完',
          level: 5,
          from: {
            username: witchPlayer.username,
            name: witchPlayer.name,
            status: witchPlayer.status,
            position: witchPlayer.position,
            role: witchPlayer.role,
            camp: witchPlayer.camp
          },
          to: {
            username: null,
            name: null,
          }
        }
      }
      await $service.baseService.save(record, recordObject)
    }

    let gameRecord = {
      roomId: gameInstance.roomId,
      gameId: gameInstance._id,
      stage: gameInstance.stage,
      day: gameInstance.day,
      content: {
        text: '天亮了！',
        type: 'text',
        level: 4,
      },
      isCommon: 1,
      isTitle: 0
    }
    await $service.baseService.save(record, gameRecord)

    // 结算所有的死亡玩家
    let diePlayerList = await $service.baseService.query(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage:{ $in: [2, 3]}, mode: 1})
    if(!diePlayerList || diePlayerList.length < 1){
      let peaceRecord = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: {
          type: 'text',
          text: '昨天晚上是平安夜!',
          level: 3,
        }
      }
      await $service.baseService.save(record, peaceRecord)
    } else {
      let dieMap = {} // 狼人和女巫杀同一个人
      for(let i = 0; i < diePlayerList.length; i++){
        if(dieMap[diePlayerList[i].target]){
          continue
        }
        let diePlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: diePlayerList[i].target})
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
              username: diePlayer.username,
              name: diePlayer.name,
              position: diePlayer.position,
              role: diePlayer.role,
              camp: diePlayer.camp
            },
            to: {
              role: 'out',
              name: '出局'
            }
          }
        }
        await $service.baseService.save(record, deadRecord)
        dieMap[diePlayerList[i].target] = diePlayer
      }
    }
    return $helper.wrapResult(true, '')
  },


  async beforeSpeak (id) {
    const { $service, $helper, $model, $support } = app
    const { game, player, record, gameTag } = $model
    if(!id){
      return $helper.wrapResult(false, 'gameId为空！', -1)
    }
    let gameInstance = await $service.baseService.queryById(game, id)
    let alivePlayer = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, status: 1})
    let randomPosition = Math.floor(Math.random() * alivePlayer.length ) + 1
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
      content: '进入投票环节，由' + $support.getPlayerFullName(targetPlayer) + '开始发言。顺序为：' + (randomOrder === 1 ? '正向' : '逆向')
    }
    await $service.baseService.save(record, recordObject)
  }
})
