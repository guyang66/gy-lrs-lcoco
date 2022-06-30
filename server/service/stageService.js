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
        content: '狼人今晚没有袭击玩家'
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
      content: '狼人今晚袭击了：' + $support.getPlayerFullName(diePlayer)
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
    if(killAction && killAction.to){
      let killTarget = killAction.to
      let killPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: killTarget})
      let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
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
        // todo: 不是毒杀的就可以给技能了，取消用 desc = poison去判断，麻烦
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
        content: $support.getPlayerFullName(witchPlayer) + '使用毒药毒死了' + $support.getPlayerFullName(poisonPlayer)
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

    // 结算所有的死亡玩家
    let diePlayerList = await $service.baseService.query(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage:{ $in: [2, 3]}, mode: 1})
    console.log('进来')
    console.log(diePlayerList)
    if(!diePlayerList || diePlayerList.length < 1){
      let peaceRecord = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: '昨天晚上是平安夜!'
      }
      await $service.baseService.save(record, peaceRecord)
    } else {
      let str = ''
      diePlayerList.forEach((item,index)=>{
        if(index !== 0){
          str = str + '和'
        }
        str = str + item.position + '号玩家（' + item.name + '）'
      })
      let deadRecord = {
        roomId: gameInstance.roomId,
        gameId: gameInstance._id,
        day: gameInstance.day,
        stage: gameInstance.stage,
        view: [],
        isCommon: 1,
        isTitle: 0,
        content: '昨天晚上死亡的是：' + str
      }
      await $service.baseService.save(record, deadRecord)
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
