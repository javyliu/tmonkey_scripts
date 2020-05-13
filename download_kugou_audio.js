 /* jshint esversion: 8 */
// ==UserScript==
// @name         自动下载酷狗音乐
// @namespace    javyliu
// @version      0.2
// @description  在酷狗音乐播放页面下载所听歌曲到本地，仅在chrome下测试通过，当第一次打开播放界面时，如果仅播放一首歌，那么是通过hash变化触发下载，也就是在列表页再次点击新的一首歌时会触发下载，试听音乐不下载，不会重复下载
// @author       javy_liu
// @include      *://*.kugou.com/song*
// @grant        GM_download
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_setClipboard
// @grant        GM_getResourceURL
// @grant        GM_getResourceText
// @grant        GM_notification
// @grant        GM_deleteValue


// @connect      *

// ==/UserScript==
// kugou.com 音乐下载
(function() {
    'use strict';
    var $ = unsafeWindow.jQuery;

    function getHashParams(key) {
        var arr = location.hash.replace("#", "").split("&"), keyValue = "";
        for (var i = 0;i<arr.length;i++) {
            if (arr[i].split("=")[0] == key) {
                keyValue = arr[i].split("=")[1];
                break;
            }
        }
        return keyValue;
    }

    //for kugou url fetch
    function promise_fetch(req_url){
        return new Promise(function(resolve, reject){
            GM_xmlhttpRequest({
                method: "GET",
                url: req_url,
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                responseType: "json",
                onload: function(r){
                    // console.log(r);
                    if(r.readyState == 4){
                        var res = r.response.data;
                        console.log("mp3地址", res.play_url);
                        resolve(res);
                    }                  
                },
                onerror: function(err){
                    console.log("请求地址失败");
                    reject("请求地址失败");
                }
            });  
        });
       
    }

    //下载url指定的资源，并指定文件名
    function promise_download(res_url, file_name){
        return new Promise(function(resolve, reject){
            GM_download({
                url: res_url,
                name: file_name,
                onload: function(){
                    resolve(`${file_name}下载完成`);
                },
                onerror: function(error){
                    reject(`${file_name}下载失败${error}`);
                }
            });
        });
       
    }


    //封装通知
    function notify(txt,title="通知"){
        GM_notification({
            title: txt,
            text: title,
            highlight: true,
            timeout: 5000,
            ondone: function(){
                console.log("关闭了通知");
            }
        });
    }


    //is_free_part 为1时为试听, 不下载试听
    //传入一个对像数组[{hash:xxx, album_id：xxx}]
    //for of 内部 break, return 会跳出循环.
    let list = GM_getValue("download_list") || {};
    var download_kugou = async function(ary_obj){
        for (var obj of ary_obj) {
            let _hash = obj.Hash;
            let _album_id = obj.album_id;

            let req_url = "https://wwwapi.kugou.com/yy/index.php?r=play/getdata&hash=" + _hash + "&album_id=" + _album_id + "&dfid=&mid=&platid=4";
            console.log("请求地址：", req_url);
            try {
                //已下载的不下载 
                if (list[_hash]) {
                    console.log("已下载",obj);
                    notify("已下载");
                    continue;
                }
                var res = await promise_fetch(req_url);
                //试听
                if (res.is_free_part) {
                    var txt = `${res.audio_name}为试听音乐`;
                    console.log(txt);
                    notify(txt);
                    continue;
                }
                var extname = res.play_url.match(/\.([\w]+?$)/)[1];
                await promise_download(res.play_url, res.audio_name + extname);
                list[res.hash] = 1;
                GM_setValue("download_list", list);
                console.log(res);
                notify(res);
            } catch (error) {
                console.log(error);
                notify(error);                
            }
        }
    };


    var play_list = JSON.parse($.jStorage.get("k_play_list"));
    //播放页面第一次打开为列表时，批量下载列表，否则通过监听hash地址变化触发下载
    if(play_list && play_list.length > 1){
        console.log("有列表：", play_list);
        download_kugou(play_list).then(function(){
            console.log("列表中的已下载完，增加单曲监听");
            window.addEventListener("hashchange", function(ev){
                download_kugou([{'Hash': ev.target.Hash, 'album_id': ev.target.album_id}]);           
            });
        });
    }else{
        window.addEventListener("hashchange", function(ev){
            download_kugou([{'Hash': ev.target.Hash, 'album_id': ev.target.album_id}]);           
        });
    }

    $("body").prepend("<button id='clear_download_list'>clear download list</button>");
    $("#clear_download_list").on("click", function(){
        GM_deleteValue("download_list");
        console.log("list:",GM_getValue("download_list"));
        notify("清除下载记录成功");
    });
  

})();