module.exports = app => ({

  /**
   * 开始游戏
   * @returns {Promise<void>}
   */
  async gameStart () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user, game, player, vision, record } = $model
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
    // 视野实例 id、roomId、gameId、from：1号玩家  to：2号玩家   0:未知 1：知道阵容，2：完全知道身份
    // 记录：

    // 创建游戏

    let gameObject = {
      roomId: roomInstance._id,
      owner: roomInstance.owner,
      status: 1,
      stage: 0, // 幕布
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
    }
    let gameInstance = await $service.baseService.save(game, gameObject)

    // 创建player
    const roleArray = ['wolf', 'wolf', 'wolf', 'villager', 'villager', 'villager', 'predictor', 'witch', 'hunter']
    // todo：后面入库把
    const skillMap = {
      wolf: [{
        name: '袭击',
        key: 'assault',
        status: 1,
      },{
        name: '自爆',
        key: 'boom',
        status: 1,
      }],
      predictor: [{
        name: '查验',
        key: 'check',
        status: 1,
      }],
      witch: [
        {
          name: '解药',
          key: 'antidote',
          status: 1,
        },
        {
          name: '毒药',
          key: 'poison',
          status: 1,
        }
      ],
      hunter: [
        {
          name: '开枪',
          key: 'shoot',
          status: 0, // 猎人最初不能开枪
        }
      ],
      villager: []
    }
    let randomPlayer = $helper.getRandomNumberArray(1,9,9, roleArray)
    for(let i =0; i < randomPlayer.length; i ++ ){
      let item = randomPlayer[i]
      let p = {
        roomId: roomInstance._id,
        gameId: gameInstance._id,
        username: roomInstance['v' + (item.number)],
        role: item.role,
        camp: item.role === 'wolf' ? 0 : 1, // 狼人阵营 ：0 ； 好人阵营：1
        status: 1, // 都是存货状态
        skill: skillMap[item.role],
        position: item.number
      }
      // 依次同步创建9个玩家
      await $service.baseService.save(player, p)
    }

    const getVisionKey = (from, to) => {
      if(from.number === to.number){
        return 2
      }
      let fromRole = from.role
      let toRole = to.role
      if(fromRole === 'wolf' && toRole === 'wolf'){
        return 2
      }
      // 村民、猎人、女巫没有视野
      // 预言家只有查验之后有视野
      return 0
    }
    // 创建视野对象
    for(let i = 0 ; i < randomPlayer.length; i++){
      for(let j = 0 ; j < randomPlayer.length; j++){
        let v = {
          roomId: roomInstance._id,
          gameId: gameInstance._id,
          from: gameInstance['v' + randomPlayer[i].number],
          to: gameInstance['v' + randomPlayer[j].number],
          status: getVisionKey(randomPlayer[i], randomPlayer[j])
        }
        // 创建9 x 9 = 81个视野
        await $service.baseService.save(vision, v)
      }
    }
    let recordObject = {
      roomId: roomInstance._id,
      gameId: gameInstance._id,
      content: '游戏开始！',
      isCommon: 0,
    }
    // record
    await $service.baseService.save(record, recordObject)
    // 改变房间状态
    await $service.baseService.updateById(room, roomInstance._id,{ status: 1, gameId: gameInstance._id})

    // 进入阶段0
    let recordObject2 = {
      roomId: roomInstance._id,
      gameId: gameInstance._id,
      content: '天黑请闭眼！',
      isCommon: 1,
    }
    await $service.baseService.save(record, recordObject2)
    $ws.connections.forEach(function (conn) {
      //todo:只能对应的频道发消息
      conn.sendText('refreshRoom')
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 根据user获取游戏信息
   * @returns {Promise<void>}
   */
  async getGameInfo () {
    const { ctx, $service, $helper, $model, $constants, $ws } = app
    const { room, user, game, player, vision, record, action, gameTag } = $model
    const {playerRoleMap, stageMap, broadcastMap} = $constants
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
    if(gameInstance.status === 0){
      ctx.body = $helper.Result.fail(-1,'该游戏已结束！')
      return
    }
    let currentUser = await $service.baseService.userInfo()
    // 查询你在游戏中的状态
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: gameInstance.roomId, gameId: gameInstance._id, username: currentUser.username})
    console.log('您的角色')
    console.log(currentPlayer)
    if(!currentPlayer){
      ctx.body = $helper.Result.fail(-1,'未查询到你在该游戏中')
      return
    }

    const getPlayerInfo = async (self) => {
      let playerInfo = []
      for(let i =0; i < 9; i ++) {
        let un = gameInstance['v' + (i + 1)]
        // 查询其他玩家信息
        let otherPlayer = await $service.baseService.queryOne(player, {username: un, gameId: gameInstance._id, roomId: gameInstance.roomId})

        if(gameInstance.status === 2){
          playerInfo.push({
            name: otherPlayer.name,
            username: otherPlayer.username,
            isSelf: un === self.username, // 是否是自己
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
        let visionInstance = await $service.baseService.queryOne(vision, {gameId: gameInstance._id, roomId: gameInstance.roomId, from: self.username, to: un})
        playerInfo.push({
          name: otherUser.name,
          username: otherUser.username,
          isSelf: un === self.username, // 是否是自己
          camp: visionInstance.status === 0 ? null : otherPlayer.camp, // 是否知晓阵营
          campName: visionInstance.status === 0 ? null : (otherPlayer.camp === 1 ? '好人阵营' : '狼人阵营'), // 是否知晓阵营
          status: otherPlayer.status, // 是否死亡
          role: visionInstance.status === 2 ? otherPlayer.role : null, // 是否知晓角色
          roleName: visionInstance.status === 2 ? (playerRoleMap[otherPlayer.role] ? playerRoleMap[otherPlayer.role].name : '') : null, // 是否知晓角色
          position: otherPlayer.position
        })
      }
      return playerInfo
    }

    const getSkillStatus = async (self) => {
      if(!self.skill || self.skill.length < 1){
        return []
      }
      let skill = self.skill
      let tmp = []
      // 查询一下当天有没有救人或者毒人，只要有2之一，女巫当晚不能再使用技能
      let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 1, from: currentPlayer.username, action: 'check'})
      let assaultAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 2, from: currentPlayer.username, action: 'assault'})
      let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, from: currentPlayer.username, action: 'antidote'})
      let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, from: currentPlayer.username, action: 'poison'})
      skill.forEach(item=>{
        if(item.key === 'boom'){
          tmp.push({
            key: item.key,
            name: item.name,
            canUse: gameInstance.stage === 5 && self.status === 1, // 自爆只能在白天发言阶段能用
            show: gameInstance.stage === 5 && self.status === 1, // (是否展示在前端)存活且轮到自己行动
          })
        } else if (item.key === 'assault') {
          let useStatus = gameInstance.stage === 2 && self.status === 1 && item.status === 1
          if(assaultAction){
            useStatus = false
          }
          tmp.push({
            key: item.key,
            name: item.name,
            canUse: useStatus, // 狼人袭击，夜晚、存活且可用
            show: gameInstance.stage === 2 && self.status === 1 && item.status === 1, // (是否展示在前端)存活且轮到自己行动，所以预言家在狼人之前行动，避免刚好被刀（第一晚可报查验，之后用不用也无法开口了），导致当晚技能用不了
          })
        } else if (item.key === 'check') {
          let useStatus = gameInstance.stage === 1 && self.status === 1 && item.status === 1
          if(checkAction){
            useStatus = false
          }
          tmp.push({
            key: item.key,
            name: item.name,
            canUse: useStatus , // 预言家查验，只要存活可一直使用
            show: gameInstance.stage === 1 && self.status === 1 && item.status === 1, // (是否展示在前端)存活且轮到自己行动，所以预言家在狼人之前行动，避免刚好被刀（第一晚可报查验，之后用不用也无法开口了），导致当晚技能用不了
          })
        } else if (item.key === 'antidote' || item.key === 'poison') {
          let useStatus = gameInstance.stage === 3 && item.status === 1 && self.status === 1
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
            show: gameInstance.stage === 3 && self.status === 1, // (是否展示在前端)存活且轮到自己行动
          })
        } else if (item.key === 'shoot') {
          const computeHunterSkill = (stage) => {
            if(item.status !== 1){
              return false
            }
            if(stage === 4 && self.status === 0){
              // 经过了晚上的洗礼，如果死亡
              return self.outReason !== 'poison'
            }
            return stage === 7 && self.status === 0;
          }
          tmp.push({
            key: item.key,
            name: item.name,
            canUse: computeHunterSkill(gameInstance.stage), // 猎人晚上不死于毒药可开枪, 被投出去可开枪
            show: true , // 是否展示在前端
          })
        }
      })
      return tmp
    }

    const getAction = async () => {
      let useStatus = gameInstance.stage === 6 && currentPlayer.status === 1
      let voteAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 6, from: currentPlayer.username, action: 'vote'})
      if(voteAction){
        // 已经投过票了
        useStatus = false
      }
      return [
        {
          key: 'vote',
          name: '投票',
          canUse: useStatus,
          show: gameInstance.stage === 6 && currentPlayer.status === 1,
        }
      ]
    }

    const getBroadcastInfo = async () => {
      if(gameInstance.status === 2){
        return [
          {
            text:'游戏结束！',
            level: 1,
          },
          {
            text: gameInstance.winner === 0 ? '狼人阵营' : '好人阵营',
            level: gameInstance.winner === 0 ? 2 : 3,
          },
          {
            text:'胜利',
            level: 1,
          },
        ]
      }
      if(gameInstance.stage === 0 && gameInstance.day === 1) {
        return broadcastMap['1-0']
      }

      if(gameInstance.stage === 0) {
        return broadcastMap['*-0']
      }

      if(gameInstance.stage === 1) {
        return broadcastMap['*-1']
      }

      if(gameInstance.stage === 2){
        return broadcastMap['*-2']
      }

      if(gameInstance.stage === 3){
        return broadcastMap['*-3']
      }

      if(gameInstance.stage === 4){
        // 结算
        if(gameInstance.status === 2){
          return [
            {
              text: '游戏已结束',
              level: 2
            },
            {
              text: gameInstance.winner === 1 ? '好人阵营' : '狼人阵营',
              level: gameInstance.winner === 1 ? 3 : 2
            },
            {
              text: '获得了胜利',
              level: 1
            }
          ]
        }

        let die = await $service.baseService.query(gameTag, {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: {$in: [3, 4]},
          mode: 1
        })
        if(!die || die.length < 1){
          return [
            {
              text: '昨天晚上是',
              level: 1
            },
            {
              text: '平安夜',
              level: 3
            }
          ]
        } else {
          let dieString = ''
          die.forEach((item,index)=>{
            if(index !== 0){
              dieString = dieString + '和'
            }
            dieString = dieString + item.position + '号玩家（' + item.name + '）'
          })
          let info = [
            {
              text: '昨天晚上死亡的是：',
              level: 1
            },
            {
              text: dieString,
              level: 2
            },
            {
              text: '，等待死亡玩家发动技能。',
              level: 1
            }
          ]
          if(gameInstance.day === 1){
            // 第一天死亡有遗言
            info.push({text: '第一晚死亡有', level: 1})
            info.push({text: '遗言', level: 2})
          } else {
            info.push({text: '没有', level: 1})
            info.push({text: '遗言', level: 2})
          }
          return info
        }
      }

      if(gameInstance.stage === 5){
        let order = await $service.baseService.queryOne(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, mode: 2})
        let info = []
        info.push({text:'进入发言环节，从', level: 1})
        info.push({text: '' + order.position + '号玩家（' + order.target + '）', level:2})
        info.push({text:'开始发言，顺序为：', level: 1})
        info.push({text:order.value === 'asc' ? '正向' : '逆向', level: 2})
        return info
      }

      if(gameInstance.stage === 6){
        return broadcastMap['*-6']
      }

      if(gameInstance.stage === 7){
        let voteTag = await $service.baseService.queryOne(gameTag,{roomId: gameInstance.roomId, gameId: gameInstance._id, day: gameInstance.day, stage: 6, mode: 1})
        if(!voteTag){
          let info = []
          info.push({text:'平票，今天没有玩家出局，没有遗言', level: 1})
          return info
        } else {
          let info = []
          info.push({text:'' + voteTag.position + '号玩家（' + voteTag.name + '）', level: 2})
          info.push({text:'被投票', level: 1})
          info.push({text:'出局', level: 2})
          info.push({text:'，等待玩家发动技能', level: 1})
          info.push({text:'，等待玩家发表遗言。', level: 1})
          return info
        }
      }

      return []
    }

    const getSystemTip = async ()=> {
      if(gameInstance.status === 2){
        return [
          {
            text:'游戏结束！',
            level: 1,
          },
          {
            text: gameInstance.winner === 0 ? '狼人阵营' : '好人阵营',
            level: gameInstance.winner === 0 ? 2 : 3,
          },
          {
            text:'胜利',
            level: 1,
          },
        ]
      }
      if((gameInstance.stage === 1 || gameInstance.stage === 2 || gameInstance.stage === 3 || gameInstance.stage === 4) && currentPlayer.role === 'predictor'){
        // 允许狼人回合、女巫回合、天亮回合给预言家在界面显示他当晚查验的信息
        let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 1, action: 'check'})
        if(!checkAction){
          return [
            {
              text: '你',
              level: 1
            },
            {
              text: '预言家',
              level: 3, // 绿色字体
            },
            {
              text: '今晚没有查验玩家',
              level: 1, // 黑色字体
            },
          ]
        }
        let checkUsername = checkAction.to
        let checkPlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: checkUsername})
        return [
          {
            text: '你',
            level: 1
          },
          {
            text: '预言家',
            level: 3, // 绿色字体
          },
          {
            text: '今晚查验的玩家为',
            level: 1, // 黑色字体
          },
          {
            text: '' + checkPlayer.position + '号玩家（' + checkPlayer.name + '),',
            level: 2, // 黑色字体
          },
          {
            text: '他的身份为',
            level: 1, // 黑色字体
          },
          {
            text: checkPlayer.camp === 1 ? '好人阵营' : '狼人阵营',
            level: checkPlayer.camp === 1 ? 3 : 2,
          },
        ]
      } else if (gameInstance.stage === 2 && currentPlayer.role === 'wolf'){
        // 2阶段可能袭击没开始或已完成
        let assaultAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, from: currentPlayer.username, action: 'assault'})
        if(assaultAction && assaultAction.to){
          let assaultPlayer = await $service.baseService.queryOne(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, username: assaultAction.to})
          return [
            {
              text: '你今晚袭击了',
              level: 1
            },
            {
              text: '' + assaultPlayer.position + '号玩家（' + assaultPlayer.name + '）',
              level: 2,
            },
          ]
        }
        return []
      } else if ((gameInstance.stage === 3 || gameInstance.stage === 4) && currentPlayer.role === 'wolf') {
        let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, action: 'kill'})
        if(!checkAction){
          return [
            {
              text: '你们',
              level: 1
            },
            {
              text: '狼人阵营',
              level: 2,
            },
            {
              text: '晚上没有袭击玩家',
              level: 1
            }
          ]
        }
        let checkUsername = checkAction.to
        let checkPlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: checkUsername})
        return [
          {
            text: '你们',
            level: 1
          },
          {
            text: '狼人阵营',
            level: 2,
          },
          {
            text: '晚上最终袭击了',
            level: 1
          },
          {
            text: '' + checkPlayer.position + '号玩家（' + checkPlayer.name + '),',
            level: 3,
          },
        ]
      } else if ((gameInstance.stage === 3) && currentPlayer.role === 'witch') {
        let checkAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 2, action: 'kill'})
        if(!checkAction){
          return [
            {
              text: '昨晚没有玩家死亡',
              level: 1
            }
          ]
        }
        let checkUsername = checkAction.to
        let checkPlayer = await $service.baseService.queryOne(player, {gameId: gameInstance._id, roomId: gameInstance.roomId, username: checkUsername})
        let currentSkills = currentPlayer.skill
        let antidoteSkill
        currentSkills.forEach(item=>{
          if(item.key === 'antidote'){
            antidoteSkill = item
          }
        })

        let info = []
        if(antidoteSkill && antidoteSkill.status === 1){
          info.push({text: '昨晚死亡的是', level: 1})
          info.push({text: '' + checkPlayer.position + '号玩家（' + checkPlayer.name + '),', level: 2,})
        }
        info.push({text: '请选择使用', level: 1})
        info.push({text: '解药', level: 3})
        info.push({text: '或者使用', level: 1})
        info.push({text: '毒药', level: 2})
        info.push({text: '毒杀别的玩家', level: 1})

        let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
        if(saveAction){
          let savePlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: saveAction.to})
          info = []
          info.push({text: '昨晚死亡的是', level: 1})
          info.push({text: '' + savePlayer.position + '号玩家（' + savePlayer.name + ')', level: 2})
          info.push({text: '，你使用了', level: 1})
          info.push({text: '解药', level: 3})
          info.push({text: '救了', level: 1})
          info.push({text: '' + savePlayer.position + '号玩家（' + savePlayer.name + ')' , level: 3})
        }

        let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId, day: gameInstance.day, stage: 3, action: 'poison'})
        if(poisonAction){
          let poisonPlayer = await $service.baseService.queryOne(player,{roomId: gameInstance.roomId, gameId: gameInstance._id, username: poisonAction.to})
          info = []
          info.push({text: '你使用了毒药毒死了', level: 1})
          info.push({text: '' + poisonPlayer.position + '号玩家（' + poisonPlayer.name + ')' , level: 2})
        }
        return info
      } else if (gameInstance.stage === 6){
        let voteAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: gameInstance.roomId,day: gameInstance.day, stage: 6, from: currentPlayer.username, action: 'vote'})
        if(voteAction && voteAction.to){
          let votePlayer = await $service.baseService.queryOne(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, username: voteAction.to})
          return [
            {
              text: '你今天投票给',
              level: 1
            },
            {
              text: '' + votePlayer.position + '号玩家（' + votePlayer.name + '）',
              level: 2,
            },
          ]
        }
        return []
      }
      return  null
    }

    let gameInfo = {
      _id: gameInstance._id,
      roomId: gameInstance.roomId,
      status: gameInstance.status,
      day: gameInstance.day,
      stage: gameInstance.stage,
      stageName: stageMap[gameInstance.stage].name,
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
      playerInfo: await getPlayerInfo(currentPlayer),
      skill: await getSkillStatus(currentPlayer),
      winner: gameInstance.winner,
      broadcast: await getBroadcastInfo(),
      systemTip: await getSystemTip(),
      action: await getAction()
    }
    ctx.body = $helper.Result.success(gameInfo)
  },

  /**
   * 强制进入下一阶段
   * @returns {Promise<void>}
   */
  async nextStage () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user, game, player, vision, record, action, gameTag } = $model
    const { roomId, gameId, role } = ctx.query
    if(!roomId || roomId === ''){
      ctx.body = $helper.Result.fail(-1,'roomId不能为空！')
      return
    }
    if(!gameId || gameId === ''){
      ctx.body = $helper.Result.fail(-1,'gameId不能为空！')
      return
    }
    let currentUser = await $service.baseService.userInfo()
    let currentPlayer = await $service.baseService.queryOne(player, {roomId: roomId, gameId: gameId, username: currentUser.username})
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
    if(gameInstance.status !== 1){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let stage = gameInstance.stage
    let nextStage = stage + 1
    let newDay = false
    if(nextStage > 7) {
      // 进入第二天流程
      nextStage = 0
      newDay = true
    }
    if(nextStage === 0){
      // 结算游戏是否结束,狼人先发动技能，先查看好人阵营存活状态

      let wolfAlive = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, role: 'wolf', status: 1})
      if(!wolfAlive || wolfAlive.length < 1){
        // 狼人死完 => 游戏结束，好人胜利
        await $service.baseService.updateById(game, gameInstance._id,{status: 2, winner: 1})
      }

      let villagerAlive = await $service.baseService.query(player,{gameId: gameInstance._id, roomId: gameInstance.roomId, role: 'villager', status: 1})
      if(!villagerAlive || villagerAlive.length < 1){
        // 屠边 - 村民 => 游戏结束，狼人胜利
        await $service.baseService.updateById(game, gameInstance._id,{status: 2, winner: 0})
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
      }

    } else if(stage === 2){
      // 狼人回合 => 女巫回合, 需要结算狼人的击杀对象和生成recod
      let assaultActionList = await $service.baseService.query(action, {roomId: roomId, gameId: gameInstance._id, day: gameInstance.day, stage: 2, action: 'assault'})
      if(!assaultActionList || assaultActionList.length < 1){
        let recordObject = {
          roomId: roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 0,
          isTitle: 0,
          content: '狼人今晚没有袭击玩家'
        }
        await $service.baseService.save(record, recordObject)
      } else{
        // 计算袭击真正需要死亡的玩家，票数多的玩家死亡，平票则随机抽选一个死亡
        let usernameList = []
        assaultActionList.forEach(item=>{
          usernameList.push(item.to)
        })
        // 找到他们中被杀次数最多的
        let target = $helper.findMaxInArray(usernameList)
        let actionObject = {
          roomId: roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          from: currentPlayer.username,
          to: target,
          action: 'kill',
        }
        await $service.baseService.save(action, actionObject)
        let diePlayer = await $service.baseService.queryOne(player,{roomId: roomId, gameId: gameInstance._id, username: target})
        let recordObject = {
          roomId: roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 0,
          isTitle: 0,
          content: '狼人今晚袭击了：' +  diePlayer.position + '号玩家（' +diePlayer.name + '）'
        }
        await $service.baseService.save(record, recordObject)
      }
    } else if(stage === 3){
      // 女巫回合 => 天亮了, 需要结算死亡玩家和游戏是否结束
      let killAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: roomId, day: gameInstance.day, stage: 2, action: 'kill'})
      if(killAction && killAction.to){
        let killTarget = killAction.to
        let killPlayer = await $service.baseService.queryOne(player,{roomId: roomId, gameId: gameInstance._id, username: killTarget})
        let saveAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: roomId, day: gameInstance.day, stage: 3, action: 'antidote'})
        if(!saveAction){
          // 女巫没有救人，不管他是没有使用技能，还是没有解药, 注定死亡一个
          let tagObject = {
            roomId: roomId,
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
          await $service.baseService.updateOne(player,{roomId: roomId, gameId: gameInstance._id, username: killPlayer.username}, {status: 0 , outReason: 'assault'})
        }
      }

      // 结算女巫毒
      let poisonAction = await $service.baseService.queryOne(action,{gameId: gameInstance._id, roomId: roomId, day: gameInstance.day, stage: 3, action: 'poison'})
      if(poisonAction && poisonAction.to){
        let poisonPlayer = await $service.baseService.queryOne(player,{roomId: roomId, gameId: gameInstance._id, username: poisonAction.to})
        let witchPlayer = await $service.baseService.queryOne(player,{roomId: roomId, gameId: gameInstance._id, username: poisonAction.from})
        await $service.baseService.updateById(player, poisonPlayer._id,{status: 0, outReason: 'poison'})
        let recordObject = {
          roomId: gameInstance.roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 0,
          isTitle: 0,
          content: '' + witchPlayer.position + '号玩家（' + witchPlayer.name + ')使用毒药毒死了' + poisonPlayer.position + '号玩家（' + poisonPlayer.name + ')'
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
      let die = await $service.baseService.query(gameTag,{roomId: roomId, gameId: gameInstance._id, day: gameInstance.day, stage:{ $in: [2, 3]}, mode: 1})
      if(!die || die.length < 1){
        let recordObject = {
          roomId: roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: '昨天晚上是平安夜'
        }
        await $service.baseService.save(record, recordObject)
      } else {
        let str = ''
        die.forEach((item,index)=>{
          if(index !== 0){
            str = str + '和'
          }
          str = str + item.position + '号玩家（' + item.name + '）'
        })
        let recordObject = {
          roomId: roomId,
          gameId: gameInstance._id,
          day: gameInstance.day,
          stage: gameInstance.stage,
          view: [],
          isCommon: 1,
          isTitle: 0,
          content: '昨天晚上死亡的是：' + str
        }
        await $service.baseService.save(record, recordObject)
      }

      // 结算游戏是否结束,狼人先发动技能，先查看好人阵营存活状态
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
          content: '游戏结束！狼人阵营赢得胜利！'
        }
        await $service.baseService.save(record, recordObject)
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
          content: '游戏结束！狼人阵营赢得胜利！'
        }
        await $service.baseService.save(record, recordObject)
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
          content: '游戏结束！好人阵营赢得胜利！'
        }
        await $service.baseService.save(record, recordObject)
      }
    } else if (stage === 4) {
      // 天亮 => 发言环节
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

    }

    let update = {stage: nextStage}
    if(newDay){
      update.day = gameInstance.day + 1
    }
    await $service.baseService.updateById(game, gameInstance._id, update)
    $ws.connections.forEach(function (conn) {
      conn.sendText('refreshGame')
    })
    ctx.body = $helper.Result.success('ok')
  },

  /**
   * 获取游戏公共事件记录
   * @returns {Promise<void>}
   */
  async commonGameRecord () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user, game, player, vision, record } = $model
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
  async checkPlayer () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user, game, player, vision, record, action } = $model
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
    if(gameInstance.status !== 1){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo()
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
      //todo:只能对应的频道发消息
      conn.sendText('refreshGame')
    })

    ctx.body = $helper.Result.success(r)
  },

  /**
   * 狼人袭击玩家
   * @returns {Promise<void>}
   */
  async assaultPlayer () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user, game, player, vision, record, action } = $model
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
    if(gameInstance.status !== 1){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo()
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
      // 'assault': '狼人袭击' , 'check': '预言家查验', 'antidote':女巫解药, 'poison':'女巫毒药', 'shoot': '猎人开枪'，'boom'：狼人自爆；'vote': '投票流放'
      action: 'assault',
    }
    await $service.baseService.save(action, actionObject)

    // 修改skill为不能使用，等下一个天黑再变为可使用。
    // await $service.baseService.updateById(player, currentPlayer._id, {
    //   skill: [
    //     {
    //       name: '袭击',
    //       key: 'assault',
    //       status: 0,
    //     },{
    //       name: '自爆',
    //       key: 'boom',
    //       status: 1,
    //     }
    //   ]
    // })
    // 某个狼人完成了击杀，不需要通知刷新状态，等待这回合结束，再结算真正死亡的是谁。
    let r = {
      username: targetPlayer.username,
      name: targetPlayer.name,
      position: targetPlayer.position,
    }

    ctx.body = $helper.Result.success(r)
  },

  async antidotePlayer () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user, game, player, vision, record, action } = $model
    const { roomId, gameId, username } = ctx.query
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
    if(gameInstance.status !== 1){
      let winner
      if(gameInstance.winner !== null && gameInstance.winner !== undefined){
        winner = gameInstance.winner === 1 ? '好人阵营' : '狼人阵营'
      }
      let winnerString = winner ? '胜利者为：' + winner : null
      ctx.body = $helper.Result.fail(-1,'游戏已经结束！' + winnerString)
      return
    }
    let currentUser = await $service.baseService.userInfo()
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
    let diePlayer = $service.baseService.queryOne(player,{roomId: roomId, gameId: gameInstance._id, username: killTarget})

    let recordObject = {
      roomId: roomId,
      gameId: gameInstance._id,
      day: gameInstance.day,
      stage: gameInstance.stage,
      view: [],
      isCommon: 0,
      isTitle: 0,
      content: '女巫——' + currentPlayer.position + '号玩家（' + currentPlayer.name +  '）' + '使用解药救了：' +  diePlayer.position + '号玩家（' +diePlayer.name + '）'
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
  async votePlayer () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user, game, player, vision, record, action } = $model
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
    if(gameInstance.status !== 1){
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
    let currentUser = await $service.baseService.userInfo()
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
   * 拥堵
   * @returns {Promise<void>}
   */
  async poisonPlayer () {
    const { ctx, $service, $helper, $model, $ws } = app
    const { room, user, game, player, vision, record, action, gameTag } = $model
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
    if(gameInstance.status !== 1){
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
    let currentUser = await $service.baseService.userInfo()
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

  }

})
