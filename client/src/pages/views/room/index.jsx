import React, {useState, useEffect} from "react";
import "./index.styl";
import {inject, observer} from "mobx-react";
import apiConfig from '@api/config'
import {withRouter} from "react-router-dom";
import Websocket from 'react-websocket';
import {Button, Modal, Input, Radio, message} from "antd";
import helper from '@helper'
import cls from "classnames";

const Index = (props) => {
  const {appStore, history} = props;
  const {user} = appStore

  let roomId =  location.state && location.state.id
  roomId = '62a7f8994a7b0329c60cfe0d'

  const [roomDetail, setRoomDetail] = useState({})
  const [seat, setSeat] = useState([])

  const [kick, setKick] = useState(false)

  const [errorPage, setErrorPage] = useState(false)

  const [modifyModal, setModifyModal] = useState(false)
  const [newName, setNewName] = useState(null)

  useEffect(()=>{
    getRoomDetail()
  },[])

  const getRoomDetail = () => {
    apiConfig.getRoomInfo({id: roomId}).then(data=>{
      console.log(data)
      setRoomDetail(data)
      initSeat(data)
    }).catch(error=>{
      setErrorPage(true)
    })
  }

  const seatIn = (index) => {
    apiConfig.seatIn({id: roomId, position: index}).then(data=>{
      message.success('入座成功！')
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

  const kickPlayer = (item) => {
    if(!item.player){
      message.warn('该位置没有坐人，请重新操作！')
      return
    }
    if(item.player.username === user.username){
      message.warn('你不能踢自己！')
      return
    }

    apiConfig.kickPlayer({id: roomId, position: item.key}).then(data=>{
      message.success('踢人成功！')
      setKick(false)
    })
  }

  const modifyName = () => {
    if(!newName || newName === ''){
      message.warn('新昵称不能为空！')
      return
    }
    apiConfig.modifyNameInRoom({id: user._id, name: newName}).then(data=>{
      message.success('修改成功！')
      setModifyModal(false)
      setNewName(null)
    })
  }

  const startGame = () => {
    apiConfig.startGame({id: roomId}).then(data=>{
    })
  }

  const quitRoom = () => {
    apiConfig.quitRoom({id: roomId, username: user.username}).then(data=>{
      history.push({pathname: '/index'})
    })
  }

  const wsMessage = (msg) => {
    console.log(msg)
    // todo: 返回 action、username，同一个人则不处理消息
    // todo: ws url有跨域问题
    if(msg === 'refreshRoom'){
      getRoomDetail()
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

        <Websocket
          url={'ws://127.0.0.1:6003/lrs/' + roomId}
          onMessage={wsMessage}
        />

        <div className="header">
          <div className="FBH FBAC FBJC">
            <span className="room-title">房间名：</span>
            <span className="room-title welcome-user color-orange">{roomDetail.name}</span>
            <span className="room-title mar-l5">密码：</span>
            <span className="room-title welcome-user color-orange">{roomDetail.password}</span>
          </div>
        </div>

        <div className="room-content">
          <div className="normal-title">桌/座位（点击空座位即可入座）：</div>
          <div className="desk-content mar-t5">
            {
              seat.map(item=>{
                return (
                  <div key={item.key} className="seat-cell mar-5 FBH FBAC FBJC">
                    {
                      kick ? (
                        <div className="FBH FBAC FBJC" onClick={()=>{kickPlayer(item)}}>
                          <div className={cls({
                              'seat-in': item.player,
                              'empty-seat': !item.player
                            })}>
                            {item.name}
                          </div>
                          {
                            item.player ? <div className="cell-text seat-status mar-l5">
                              <Button className="color-red kick-btn">踢人</Button>
                            </div> : <div className="cell-text seat-status mar-l5">{' '}</div>
                          }
                        </div>
                      ) : (
                        <div className="FBH FBAC FBJC" onClick={()=>{seatIn(item.key)}} style={{cursor: 'pointer'}}>
                          <div className={cls({
                            'seat-in': item.player,
                            'empty-seat': !item.player
                          })}>
                            {item.name}
                          </div>
                          {
                            item.player ? <div className="cell-text color-success seat-status mar-l5">
                              {item.player.name}
                            </div> : <div className="cell-text color-red seat-status mar-l5">空缺</div>
                          }
                        </div>
                      )
                    }
                  </div>
                )
              })
            }
          </div>
          <div className="normal-title mar-t10">等待区（尚未入座的玩家）：</div>
          <div className="wait-content mar-t5 FBH">
            {
              (roomDetail.waitPlayer || []).map(item=>{
                return <div className="wait-cell mar-10" key={'wait-cell' + item}>{item.name}</div>
              })
            }
          </div>

          {
            helper.hasCPermission('system.host', appStore) ? <Button
              size="large"
              className={cls({
                'btn-primary': !!roomDetail.seatStatus,
                'btn-info': !roomDetail.seatStatus,
                'mar-t10 full-btn': true,
              })}
              disabled={!roomDetail.seatStatus}
              onClick={
                ()=>{
                  startGame()
                }
              }
            >
              开始游戏
            </Button> : null
          }
          {
            helper.hasCPermission('system.host', appStore) ? <Button
              className={cls({
                'btn-danger': !kick,
                'btn-info': kick,
                'mar-t10 full-btn': true,
              })}
              size="large"
              onClick={
                ()=>{
                  setKick(!kick)
                }
              }
            >
              {kick ? '取消踢人' : '踢人'}
            </Button> : null
          }
          <Button
            className="btn-warning mar-t10 full-btn"
            size="large"
            onClick={
              ()=>{
                setNewName(user.name)
                setModifyModal(true)
              }
            }
          >
            修改昵称
          </Button>
        </div>

        <div className="footer">
          <Button
            className="logout-btn btn-delete"
            size="large"
            onClick={
              ()=>{
                quitRoom()
              }
            }
          >
            退出房间
          </Button>
        </div>
      </div>


      <Modal
        title="修改昵称"
        centered
        className="modal-view-wrap"
        maskClosable={false}
        maskStyle={{
          backgroundColor: 'rgba(0,0,0,0.1)',
        }}
        visible={modifyModal}
        onOk={modifyName}
        okText="确认"
        cancelText="取消"
        onCancel={() => {
          setModifyModal(false)
          setNewName(null)
        }}
      >
        <div>
          <div className="item-cell FBH FBAC mar-b10">
            <div className="item-title">新昵称：</div>
            <Input
              className="item-cell-content"
              placeholder="请输入新昵称"
              value={newName}
              onChange={e =>{
                setNewName(e.target.value)
              }}
            />
          </div>
        </div>
      </Modal>

    </div>
  )
}
export default withRouter(inject('appStore')(observer(Index)))

