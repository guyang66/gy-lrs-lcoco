import React, {useState, useEffect} from "react";
import "./index.styl";
import {inject, observer} from "mobx-react";
import {withRouter} from "react-router-dom";

import apiGame from '@api/game'
import apiRoom from '@api/room'

import {Button, Modal, message} from "antd";
import GameHeaderView from "@components/game/gameHeader";
import GameFooterView from "@components/game/gameFooter";
import GameReadyView from "@components/game/gameReady";
import GameContentView from "@components/game/gameContent";
import GameBtnView from "@components/game/gameButton";

import RecordView from "@components/game/gameRecord";

import Websocket from 'react-websocket';

import predictor from "@assets/images/role/card/yuyanjia.png"
import hunter from "@assets/images/role/card/lieren.png"
import witch from "@assets/images/role/card/nvwu.png"
import villager from "@assets/images/role/card/pingming.png"
import wolf from "@assets/images/role/card/langren.png"
import vote from "@assets/images/role/skill/vote.svg"
import loser from "@assets/images/shibai.svg"

import utils from '@utils'
import cls from "classnames";

const { confirm, info } = Modal;

const Index = (props) => {
  const {appStore, history} = props;
  const {user} = appStore

  let roomId =  history.location.state && history.location.state.id

  const roleCardMap = {
    'predictor': predictor,
    'hunter': hunter,
    'witch': witch,
    'villager': villager,
    'wolf': wolf,
  }

  const [roomDetail, setRoomDetail] = useState({})
  const [gameDetail, setGameDetail] = useState({})
  const [playerInfo, setPlayerInfo] = useState([])
  const [currentRole, setCurrentRole] = useState({})
  const [skillInfo, setSkillInfo] = useState([])
  const [actionInfo, setActionInfo] = useState([])

  const [seat, setSeat] = useState([])

  const [errorPage, setErrorPage] = useState(false)

  const [recordModal, setRecordModal] = useState(false)
  const [gameRecord, setGameRecord] = useState([])

  const [checkModal, setCheckModal] = useState(false)
  const [checkPlayer, setCheckPlayer] = useState([])
  const [checkResult, setCheckResult] = useState(null)

  const [assaultModal, setAssaultModal] = useState(false)
  const [assaultPlayer, setAssaultPlayer] = useState([])
  const [assaultResult, setAssaultResult] = useState(null)

  const [voteModal, setVoteModal] = useState(false)
  const [votePlayer, setVotePlayer] = useState([])
  const [voteResult, setVoteResult] = useState(null)

  const [poisonModal, setPoisonModal] = useState(false)
  const [poisonPlayer, setPoisonPlayer] = useState([])
  const [poisonResult, setPoisonResult] = useState(null)

  const [shootModal, setShootModal] = useState(false)
  const [shootPlayer, setShootPlayer] = useState([])
  const [shootResult, setShootResult] = useState(null)

  const [socketOn,setSocketOn] = useState(true)

  const [roleCard, setRoleCard] = useState(null)
  const [winCard, setWinCard] = useState(null)

  const [timerTime, setTimerTime] = useState(null)

  useEffect(()=>{
    getRoomDetail()
  },[])

  const getRoomDetail = (isBegin) => {
    apiRoom.getRoomInfo({id: roomId}).then(data=>{
      setRoomDetail(data)
      if(data.status === 0){
        initSeat(data)
      } else if (data.status === 1) {
        initGame(data.gameId, data._id, isBegin)
      }
    }).catch(error=>{
      console.log('获取房间信息失败！',error)
      setErrorPage(true)
    })
  }

  const initGame = (gameId, roomId, isBegin) => {
    if(!gameId){
      console.log('initGame失败：gameId不存在')
      message.warn('游戏id不存在！')
      return
    }
    apiGame.getGameInfo({id: gameId, roomId: roomId}).then(data=>{
      setGameDetail(data)
      setCurrentRole(data.roleInfo || {})
      setPlayerInfo(data.playerInfo || [])
      setSkillInfo(data.skill || [])
      setActionInfo(data.action || [])
      if(isBegin){
        openRoleCard(data.roleInfo)
      }
    }).catch(error=>{
      console.log('发生了错误！',error)
      setErrorPage(true)
    })
  }

  const initSeat = (detail) => {
    if(!detail.seat){
      let p = []
      for(let i =0; i< 9; i++){
        p.push({
          index: i,
          key: i + 1,
          name: (i + 1) + '号',
          player: null
        })
      }
      setSeat(p)
    } else {
      let p = []
      for(let i =0; i< detail.seat.length; i++){
        let item = detail.seat[i]
        p.push({
          index: i,
          key: item.position,
          name: item.name,
          player: item.player ? item.player : null
        })
      }
      // 排序
      p.sort(function (a,b){
        return a.key - b.key
      })
      setSeat(p)
    }
  }

  const initRecordList = (data) => {
    let tmp = []
    for(let key in data){
      tmp.push(data[key])
    }
    setGameRecord(tmp)
    setRecordModal(true)
  }


  const quitRoom = () => {
    if(!roomId){
      history.push({pathname: '/index'})
      return
    }
    setSocketOn(false)
    apiRoom.quitRoom({id: roomId, username: user.username}).then(data=>{
      history.push({pathname: '/index'})
    }).catch(()=>{
      setSocketOn(true)
    })
  }

  const nextStage = () => {
    confirm(
      {
        title: '确定进入下一阶段吗？',
        okText: '确定',
        cancelText: '取消',
        onOk() {
          apiGame.nextStage({roomId: gameDetail.roomId, gameId: gameDetail._id}).then(data=>{
            message.success('操作成功！')
          })
        }
      }
    )
  }

  const lookRecord = () => {
    apiGame.gameRecord({roomId: gameDetail.roomId, gameId: gameDetail._id}).then(data=>{
      initRecordList(data)
    })
  }


  const useSkill = (key) => {
    if(key === 'check'){
      // 预言家查验, 计算查验数组
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(item.status === 0){
          // 死人不能查
          canCheck = false
        } else if (item.isSelf){
          // 不能查验自己
          canCheck = false
        } else if (item.camp !== null && item.camp !== undefined){
          // 知晓身份的也不用查
          canCheck = false
        }
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      setCheckPlayer(tmp)
      setCheckModal(true)
    } else if(key === 'assault'){
      // 预言家查验, 计算查验数组
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(item.status === 0){
          // 死人不能杀
          canCheck = false
        }
        // 狼人是可以杀自己和队友的
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      setAssaultPlayer(tmp)
      setAssaultModal(true)
    } else if(key === 'antidote'){
      // 预言家查验, 计算查验数组
      confirm(
        {
          title: '确定要救该玩家吗？',
          okText: '确定',
          cancelText: '取消',
          onOk() {
            antidotePlayerAction()
          }
        }
      )
    } else if(key === 'vote'){
      // 投票环节
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(item.status === 0){
          // 死人不能投
          canCheck = false
        }
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      setVotePlayer(tmp)
      setVoteModal(true)
    } else if (key === 'poison') {
      // 毒人
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(item.status === 0){
          // 死人不能毒
          canCheck = false
        }
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      setPoisonPlayer(tmp)
      setPoisonModal(true)
    } else if (key === 'shoot') {
      // 开枪
      let tmp = []
      playerInfo.forEach(item=>{
        let canCheck = true
        if(item.status === 0){
          // 不能对死人开枪
          canCheck = false
        }
        tmp.push({...item, check: canCheck, isTarget: false})
      })
      setShootPlayer(tmp)
      setShootModal(true)
    } else if (key === 'boom'){
      confirm(
        {
          title: '确定要自爆吗（自爆之后直接进入天黑）？',
          okText: '确定',
          cancelText: '取消',
          onOk() {
            boomAction()
          }
        }
      )
    }
  }

  const checkPlayerAction = (item) => {
    confirm(
      {
        title: '确定要查验该玩家吗？',
        okText: '确定',
        cancelText: '取消',
        onOk() {
          fetchCheckPlayer(item)
        }
      }
    )
  }

  const boomAction = () => {
    if(currentRole.role !== 'wolf'){
      message.warn('你不是狼人，不能进行自爆操作！')
      return
    }
    apiGame.boomAction({roomId: gameDetail.roomId, gameId: gameDetail._id}).then(data=>{
      message.success('自爆成功')
    })
  }

  const assaultPlayerAction = (item) => {
    confirm(
      {
        title: '确定要袭击该玩家吗？',
        okText: '确定',
        cancelText: '取消',
        onOk() {
          fetchAssaultPlayer(item)
        }
      }
    )
  }
  const antidotePlayerAction = () => {
    if(currentRole.role !== 'witch'){
      message.warn('你不是女巫，不能进行此操作！')
      return
    }
    apiGame.antidotePlayer({roomId: gameDetail.roomId, gameId: gameDetail._id}).then(data=>{
      message.success('操作成功')
      initGame(gameDetail._id, roomDetail._id)
    })
  }

  const votePlayerAction = (item) => {
    confirm(
      {
        title: '确定要投票该玩家吗？',
        okText: '确定',
        cancelText: '取消',
        onOk() {
          apiGame.votePlayer({roomId: gameDetail.roomId, gameId: gameDetail._id, username: item.username}).then(data=>{
            setVoteResult({...data, prompt: '投票结束，等待其他人的投票结果，由主持人确认完毕之后进入下一阶段'})
            let newVotePlayer = JSON.parse(JSON.stringify(votePlayer))
            let tmp = []
            newVotePlayer.forEach(item=>{
              if(item.username === data.username){
                let obj = {...item, isTarget: true}
                tmp.push(obj)
              } else {
                tmp.push(item)
              }
            })
            setVotePlayer(tmp)
            //刷新
            initGame(gameDetail._id, gameDetail.roomId)
          })
        }
      }
    )
  }

  const fetchAssaultPlayer = (item) => {
    if(currentRole.role !== 'wolf'){
      message.warn('你不是狼人，不能进行此操作！')
      return
    }
    let username = item.username
    apiGame.assaultPlayer({roomId: gameDetail.roomId, gameId: gameDetail._id, username: username}).then(data=>{
      setAssaultResult({...data, prompt: '袭击完成后，确认队友完成之后，点击『下一阶段』按钮或主页面的操作选项中的『进入下一阶段』 进入一下阶段：女巫行动回合'})
      let newAssaultPlayer = JSON.parse(JSON.stringify(assaultPlayer))
      let tmp = []
      newAssaultPlayer.forEach(item=>{
        if(item.username === data.username){
          let obj = {...item, isTarget: true}
          tmp.push(obj)
        } else {
          tmp.push(item)
        }
      })
      setAssaultPlayer(tmp)
      //刷新
      initGame(gameDetail._id, gameDetail.roomId)
    })
  }

  const fetchCheckPlayer = (item) => {
    if(currentRole.role !== 'predictor'){
      message.warn('你不是预言家，不能进行此操作！')
      return
    }
    let username = item.username
    apiGame.checkPlayerRole({roomId: gameDetail.roomId, gameId: gameDetail._id, username: username}).then(data=>{
      setCheckResult({...data, prompt: '记住你的查验信息后，点击『下一阶段』按钮或主页面的操作选项中的『进入下一阶段』 进入一下阶段：狼人行动回合'})
      let newCheckPlayer = JSON.parse(JSON.stringify(checkPlayer))
      let tmp = []
      newCheckPlayer.forEach(item=>{
        if(item.username === data.username){
          let obj = {...item, camp: data.camp, campName: data.campName, isTarget: true}
          tmp.push(obj)
        } else {
          tmp.push(item)
        }
      })
      setCheckPlayer(tmp)
      //刷新
      initGame(gameDetail._id, gameDetail.roomId)
    })
  }

  const poisonPlayerAction = (item)=> {
    confirm(
      {
        title: '确定撒毒该玩家吗？',
        okText: '确定',
        cancelText: '取消',
        onOk() {
          fetchPoisonPlayer(item)
        }
      }
    )
  }

  const shootPlayerAction = (item)=> {
    confirm(
      {
        title: '确定要开枪带走该玩家吗？',
        okText: '确定',
        cancelText: '取消',
        onOk() {
          fetchShootPlayer(item)
        }
      }
    )
  }

  const fetchShootPlayer = (item) => {
    if(currentRole.role !== 'hunter'){
      message.warn('你不是猎人，不能进行此操作！')
      return
    }
    let username = item.username
    apiGame.shootPlayerRole({roomId: gameDetail.roomId, gameId: gameDetail._id, username: username}).then(data=>{
      setShootResult({...data, prompt: ''})
      let newShootPlayer = JSON.parse(JSON.stringify(shootPlayer))
      let tmp = []
      newShootPlayer.forEach(item=>{
        if(item.username === data.username){
          let obj = {...item, camp: data.camp, campName: data.campName, isTarget: true}
          tmp.push(obj)
        } else {
          tmp.push(item)
        }
      })
      setShootPlayer(tmp)
      //刷新
      initGame(gameDetail._id, gameDetail.roomId)
    })
  }

  const fetchPoisonPlayer = (item) => {
    if(currentRole.role !== 'witch'){
      message.warn('你不是女巫，不能进行此操作！')
      return
    }
    let username = item.username
    apiGame.poisonPlayerRole({roomId: gameDetail.roomId, gameId: gameDetail._id, username: username}).then(data=>{
      setPoisonResult({...data, prompt: '点击『下一阶段』按钮或主页面的操作选项中的『进入下一阶段』 进入一下阶段：天亮了'})
      let newPoisonPlayer = JSON.parse(JSON.stringify(poisonPlayer))
      let tmp = []
      newPoisonPlayer.forEach(item=>{
        if(item.username === data.username){
          let obj = {...item, camp: data.camp, campName: data.campName, isTarget: true}
          tmp.push(obj)
        } else {
          tmp.push(item)
        }
      })
      setPoisonPlayer(tmp)
      //刷新
      initGame(gameDetail._id, gameDetail.roomId)
    })
  }

  const openRoleCard = (roleInfo) => {
    let src = roleCardMap[currentRole.role]
    if(roleInfo){
      src = roleCardMap[roleInfo.role]
    }
    const config = {
      title: '您的身份是',
      icon: null,
      okText: '确认',
      content: (
        <div className="role-card-wrap FBV FBAC">
          <img className="card-img" src={src}/>
        </div>
      )
    }
    let roleCardView = info(config)
    setRoleCard(roleCardView)
  }


  const showWinner = (data) => {
    const config = {
      okText: '确定',
      icon: null,
      title: (
        <div className="color-red winner-title FBH FBJC">
          <div className={cls({
            'color-red': data.winner === 0,
            'color-orange': data.winner === 1
          })}>{data.winnerString}</div>
          <div className="mar-l5 color-green">胜利!</div>
        </div>
      ),
      content: (
        <div className="winner-wrap">
          <div className="img-card-wrap FBV FBAC FBJC">
            <img src={roleCardMap[currentRole.role]} />
            {
              currentRole.camp === data.winner ? null : (
                <>
                  <div className="winner-mask" />
                  <div className="winner-mask-text-wrap FBV FBAC FBJC">
                    <img src={loser} />
                    <div className="txt mar-t10">很遗憾，你输了~</div>
                  </div>
                </>
              )
            }
          </div>
        </div>
      )
    }
    let winCardView = info(config)
    setWinCard(winCardView)
  }

  const wsMessage = (msg) => {
    if(msg === 'refreshRoom'){
      if(socketOn){
        getRoomDetail()
      }
    } else if (msg === 'refreshGame') {
      initGame(gameDetail._id, roomDetail._id)
    } else if (msg === 'gameStart'){
      getRoomDetail(true)
    } else if (msg === 'gameOver') {
      apiGame.gameResult({id: gameDetail._id}).then(data=>{
        // 关闭所有的弹窗
        setAssaultModal(false)
        setRecordModal(false)
        setCheckModal(false)
        setShootModal(false)
        setPoisonModal(false)
        setVoteModal(false)
        showWinner(data)
      })
    } else if (msg === 'reStart'){
      setAssaultModal(false)
      setRecordModal(false)
      setCheckModal(false)
      setShootModal(false)
      setPoisonModal(false)
      setVoteModal(false)
      setGameDetail({})
      setPlayerInfo([])
      setCurrentRole({})
      setSkillInfo([])
      setActionInfo([])
      setGameRecord([])
      setCheckPlayer([])
      setCheckResult(null)
      setAssaultPlayer([])
      setAssaultResult(null)
      setVotePlayer([])
      setVoteResult(null)
      setPoisonPlayer([])
      setPoisonResult(null)
      setShootPlayer([])
      setShootResult(null)
      if(winCard){
        winCard.destroy()
      }
      if(roleCard){
        roleCard.destroy()
      }
      if(socketOn){
        getRoomDetail()
      }
    } else {
      // 处理定时器
      let msgData = JSON.parse(msg)
      if(msgData.time !== null ){
        setTimerTime(msgData.time)
      }
    }
  }

  if(errorPage){
    return (
      <div className="error-view FBV FBAC">
        <div className="desc mar-b20 mar-t40">您被房主踢了！</div>
        <Button className="btn-primary" onClick={quitRoom}>
          返回首页
        </Button>
      </div>
    )
  }

  return (
    <div className="room-container">
      <div className="room-wrap FBV">

        {/*websocket*/}
        <Websocket url={'ws://' + utils.getWsUrl() + ':6003/lrs/' + roomId} onMessage={wsMessage} />

        {/*header*/}
        <GameHeaderView roomDetail={roomDetail} gameDetail={gameDetail} />

        {/*游戏准备*/}
        { roomDetail.status === 0 ? <GameReadyView seat={seat} roomDetail={roomDetail} /> : null }

        {/*游戏进行*/}
        { roomDetail.status === 1 ? (
          <GameContentView
            gameDetail={gameDetail}
            currentRole={currentRole}
            skillInfo={skillInfo}
            openRoleCard={openRoleCard}
            timerTime={timerTime}
            actionInfo={actionInfo}
            playerInfo={playerInfo}
            useSkill={useSkill}
          />
        ) : null }

        {/*footer*/}
        <GameFooterView quitRoom={quitRoom} />

        {/*悬浮游戏按钮*/}
        <GameBtnView gameDetail={gameDetail} lookRecord={lookRecord} getRoomDetail={getRoomDetail} nextStage={nextStage} />
      </div>

      <Modal
        title="游戏事件记录"
        centered
        closable={false}
        className="modal-view-wrap game-record-modal"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={recordModal}
        footer={[
          <Button className="btn-primary" onClick={()=>{
            setGameRecord([])
            setRecordModal(false)
          }}>
            关闭
          </Button>
        ]}
      >
        <RecordView gameRecord={gameRecord} />
      </Modal>

      <Modal
        title="查验玩家"
        centered
        closable={false}
        className="modal-view-wrap player-click-modal"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={checkModal}
        footer={[
          <Button className="btn-primary" onClick={()=>{
            setCheckPlayer([])
            setCheckModal(false)
            setCheckResult(null)
          }}>
            关闭
          </Button>
        ]}
      >
        <div className="content-wrap">
          <div className="content-view">
            {
              checkPlayer.map(item=>{
                return (
                  <div
                    className={cls({
                      'player-cell FBV FBAC FBJC': true,
                      'check-item': item.check && !item.isTarget,
                      'normal-item': !item.check && !item.isTarget,
                      'target-item': item.isTarget
                    })}
                    key={item.position}>
                    <div  className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check,
                      'mar-t20': !item.check || item.isTarget
                    })}>
                      {item.position + '号玩家' + (item.isSelf ? '(我)' : '')}
                    </div>
                    <div className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check
                    })}>
                      {item.name}
                    </div>
                    {
                      (item.check && !item.isTarget) ? (<Button size="small"
                                            onClick={()=>{checkPlayerAction(item)}}
                                            className="btn-primary">
                        查看他的身份
                      </Button>) : null
                    }
                    {
                      (item.camp !== null && item.camp !== undefined) ? (
                        <div className={cls({
                          'camp-tag': true,
                          'bg-green': item.camp === 1,
                          'bg-red': item.camp !== 1
                        })}>
                          {item.camp === 1 ? '好人阵营' : '狼人阵营'}
                        </div>
                      ) : null
                    }
                  </div>
                )
              })
            }
          </div>
          {
            checkResult ? (
              <div className="result-view FBH FBAC mar-t10 mar-l20 mar-r20">
                <div className="tit w-70">查验结果：</div>
                <div className="content">
                  <div>
                    <span>{checkResult.position + '号玩家（' + checkResult.name + ')的身份是：'}</span>
                    <span className="color-red bolder">{checkResult.campName}</span>
                  </div>
                </div>
              </div>
            ) : null
          }
        </div>
      </Modal>

      <Modal
        title="袭击玩家"
        centered
        closable={false}
        className="modal-view-wrap player-click-modal"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={assaultModal}
        footer={[
          <Button className="btn-primary" onClick={()=>{
            setAssaultPlayer([])
            setAssaultModal(false)
            setAssaultResult(null)
          }}>
            关闭
          </Button>
        ]}
      >
        <div className="content-wrap">
          <div className="content-view">
            {
              assaultPlayer.map(item=>{
                return (
                  <div
                    className={cls({
                      'player-cell FBV FBAC FBJC': true,
                      'check-item': item.check && !item.isTarget,
                      'normal-item': !item.check && !item.isTarget,
                      'target-item': item.isTarget
                    })}
                    key={item.position}>
                    <div  className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check,
                      'mar-t20': !item.check || item.isTarget
                    })}>
                      {item.position + '号玩家' + (item.isSelf ? '(我)' : '')}
                    </div>
                    <div className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check
                    })}>
                      {item.name}
                    </div>
                    {
                      (item.check && !item.isTarget) ? (<Button size="small"
                                                                onClick={()=>{assaultPlayerAction(item)}}
                                                                className="btn-folk">
                        袭击他
                      </Button>) : null
                    }
                    {
                      (item.camp !== null && item.camp !== undefined) ? (
                        <div className={cls({
                          'camp-tag': true,
                          'bg-green': item.camp === 1,
                          'bg-red': item.camp !== 1
                        })}>
                          {item.roleName}
                        </div>
                      ) : null
                    }
                  </div>
                )
              })
            }
          </div>
          {
            assaultResult ? (
              <div className="result-view FBH FBAC mar-t10 mar-l20 mar-r20">
                <div className="tit w-70">袭击结果：</div>
                <div className="content">
                  <div>
                    <span>{'你袭击了'}</span>
                    <span className="color-red">{assaultResult.position + '号玩家（' + assaultResult.name + ')。'}</span>
                  </div>
                </div>
              </div>
            ) : null
          }
        </div>
      </Modal>

      <Modal
        title="投票"
        centered
        closable={false}
        className="modal-view-wrap player-click-modal"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={voteModal}
        footer={[
          <Button className="btn-primary" onClick={()=>{
            setVotePlayer([])
            setVoteModal(false)
            setVoteResult(null)
          }}>
            关闭
          </Button>
        ]}
      >
        <div className="content-wrap">
          <div className="content-view">
            {
              votePlayer.map(item=>{
                return (
                  <div
                    className={cls({
                      'player-cell FBV FBAC FBJC': true,
                      'check-item': item.check && !item.isTarget,
                      'normal-item': !item.check && !item.isTarget,
                      'target-item': item.isTarget
                    })}
                    key={item.position}>
                    <div  className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check,
                      'mar-t20': !item.check || item.isTarget
                    })}>
                      {item.position + '号玩家' + (item.isSelf ? '(我)' : '')}
                    </div>
                    <div className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check
                    })}>
                      {item.name}
                    </div>
                    {
                      (item.check && !item.isTarget) ? (<Button size="small"
                                                                onClick={()=>{votePlayerAction(item)}}
                                                                className="btn-primary">
                        投票
                      </Button>) : null
                    }
                  </div>
                )
              })
            }
          </div>
          {
            voteResult ? (
              <div className="result-view FBH FBAC mar-t10 mar-l20 mar-r20">
                <div className="tit w-70">投票结果：</div>
                <div className="content">
                  <div>
                    <span>{'你投给了'}</span>
                    <span className="color-red">{voteResult.position + '号玩家（' + voteResult.name + ')'}</span>
                  </div>
                </div>
              </div>
            ) : null
          }
        </div>
      </Modal>

      <Modal
        title="使用毒药"
        centered
        closable={false}
        className="modal-view-wrap player-click-modal"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={poisonModal}
        footer={[
          <Button className="btn-primary" onClick={()=>{
            setPoisonPlayer([])
            setPoisonModal(false)
            setPoisonResult(null)
          }}>
            关闭
          </Button>
        ]}
      >
        <div className="content-wrap">
          <div className="content-view">
            {
              poisonPlayer.map(item=>{
                return (
                  <div
                    className={cls({
                      'player-cell FBV FBAC FBJC': true,
                      'check-item': item.check && !item.isTarget,
                      'normal-item': !item.check && !item.isTarget,
                      'target-item': item.isTarget
                    })}
                    key={item.position}>
                    <div  className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check,
                      'mar-t20': !item.check || item.isTarget
                    })}>
                      {item.position + '号玩家' + (item.isSelf ? '(我)' : '')}
                    </div>
                    <div className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check
                    })}>
                      {item.name}
                    </div>
                    {
                      (item.check && !item.isTarget) ? (<Button size="small"
                                                                onClick={()=>{poisonPlayerAction(item)}}
                                                                className="btn-error">
                        毒他
                      </Button>) : null
                    }
                  </div>
                )
              })
            }
          </div>
          {
            poisonResult ? (
              <div className="result-view FBH FBAC mar-t10 mar-l20 mar-r20">
                <div className="tit w-70">毒药结果：</div>
                <div className="content">
                  <div>
                    <span>{'你毒死了'}</span>
                    <span className="color-red">{poisonResult.position + '号玩家（' + poisonResult.name + ')'}</span>
                  </div>
                </div>
              </div>
            ) : null
          }
        </div>
      </Modal>

      <Modal
        title="开枪"
        closable={false}
        centered
        className="modal-view-wrap player-click-modal"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={shootModal}
        footer={[
          <Button className="btn-primary" onClick={()=>{
            setShootPlayer([])
            setShootModal(false)
            setShootResult(null)
          }}>
            关闭
          </Button>
        ]}
      >
        <div className="content-wrap">
          <div className="content-view">
            {
              shootPlayer.map(item=>{
                return (
                  <div
                    className={cls({
                      'player-cell FBV FBAC FBJC': true,
                      'check-item': item.check && !item.isTarget,
                      'normal-item': !item.check && !item.isTarget,
                      'target-item': item.isTarget
                    })}
                    key={item.position}>
                    <div  className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check,
                      'mar-t20': !item.check || item.isTarget
                    })}>
                      {item.position + '号玩家' + (item.isSelf ? '(我)' : '')}
                    </div>
                    <div className={cls({
                      'txt': true,
                      'check-text': item.check,
                      'normal-text': !item.check
                    })}>
                      {item.name}
                    </div>
                    {
                      (item.check && !item.isTarget) ? (<Button size="small"
                                                                onClick={()=>{shootPlayerAction(item)}}
                                                                className="btn-warning">
                        开枪
                      </Button>) : null
                    }
                    {
                      (item.camp !== null && item.camp !== undefined) ? (
                        <div className={cls({
                          'camp-tag': true,
                          'bg-green': item.camp === 1,
                          'bg-red': item.camp !== 1
                        })}>
                          {item.roleName}
                        </div>
                      ) : null
                    }
                  </div>
                )
              })
            }
          </div>
          {
            shootResult ? (
              <div className="result-view FBH FBAC mar-t10 mar-l20 mar-r20">
                <div className="tit w-70">开枪结果：</div>
                <div className="content">
                  <div>
                    <span>{'你开枪带走了'}</span>
                    <span className="color-red">{shootResult.position + '号玩家（' + shootResult.name + ')。'}</span>
                  </div>
                </div>
              </div>
            ) : null
          }
        </div>
      </Modal>

    </div>
  )
}
export default withRouter(inject('appStore')(observer(Index)))

