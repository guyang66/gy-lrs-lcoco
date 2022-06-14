import React, {useState, useEffect} from "react";
import "./index.styl";
import {inject, observer} from "mobx-react";
import apiConfig from '@api/config'
import {withRouter} from "react-router-dom";

import {Button, Modal, Input, Radio, message} from "antd";
import helper from '@helper'

const Index = (props) => {
  const {appStore, history} = props;
  const {user} = appStore

  let roomId =  location.state && location.state.id
  roomId = '62a7f8994a7b0329c60cfe0d'

  const [roomDetail, setRoomDetail] = useState({})
  const [seat, setSeat] = useState([])

  const [kick, setKick] = useState(false)

  useEffect(()=>{
    getRoomDetail()
  },[])

  const getRoomDetail = () => {
    apiConfig.getRoomInfo({id: roomId}).then(data=>{
      console.log(data)
      setRoomDetail(data)
      initSeat(data)
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

  const quitRoom = () => {
    history.push({pathname: '/index'})
  }

  return (
    <div className="room-container">
      <div className="room-wrap FBV">

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
                  <div key={item.key} className="seat-cell mar-5 FBH FBAC FBJC" onClick={()=>{seatIn(item.key)}}>
                    {
                      item.player ? (
                        <>
                          <div className="seat-in">
                            {item.name}
                          </div>
                          {
                            kick ? <div className="cell-text seat-status color-red mar-l5">
                              踢他
                            </div> : <div className="cell-text seat-status color-success mar-l5">
                              {item.player.name}
                            </div>
                          }
                        </>
                      ) : (
                        <>
                          <div className="empty-seat">
                            {item.name}
                          </div>
                          {
                            kick ? null : <div className="cell-text seat-status color-red mar-l5">
                              空缺
                            </div>
                          }
                        </>
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
              className="btn-primary mar-t10 mar-b10 game-start-btn"
              size="large"
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
              className="btn-danger mar-t10 mar-b10 game-start-btn"
              size="large"
              onClick={
                ()=>{
                  setKick(true)
                }
              }
            >
              踢人
            </Button> : null
          }
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
    </div>
  )
}
export default withRouter(inject('appStore')(observer(Index)))

