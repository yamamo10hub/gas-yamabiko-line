//GAS設定情報　Start

//環境変数としてプロパティを登録する必要がある
// LINE_CH_TOKEN : LineDevloppersで作成したチャネルのID
// SHEET_ID      : 読み込むGASスプレッドシートのID
// USER_UKI      : LineDevloppersの自分のID
// FORM_URL      : 新規作成したフォームのID(短縮していてもよい)
// また、コンテナバインドスクリプトを使用した

//LINE Developersで取得したアクセストークン
var CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CH_TOKEN');

//LINE用　postURL と pushURL
var line_endpoint = 'https://api.line.me/v2/bot/message/reply';
var line_pushmsg  = 'https://api.line.me/v2/bot/message/push';

//SpreadSheetのURL
var SS = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
var data_ss = SS.getSheetByName("りすと");
var log_ss = SS.getSheetByName("ログ");
var gomi_ss = SS.getSheetByName("ゴミ捨て");
var todo_ss = SS.getSheetByName("forminput");

//入力フォームのURL
//var Form = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_URL'));
var Form = PropertiesService.getScriptProperties().getProperty('FORM_URL');
//log用SpreadSheetをつかったロギング
function logging (str) {
  ts = new Date().toLocaleString('japanese', {timezone: 'Asia/Tokyo'});
  log_ss.appendRow([ts, str]);
}
//GAS設定情報　End

// フォームから回答を取得する時呼び出される関数
function submitForm(e) {
  logging(JSON.stringify(e));
  var range = e.range;
  var array = e.values;
  var timestamp = array[0];
  var todo = array[1];
  var timing = array[2];
  var message = 'todo入力がありました！\n' + '日時：' + timestamp + 
  '\n内容：' + todo + '\n頻度：' + timing;
  pushMessage(message);
  //var json = e.namedValues;
  //Logger.log(json);
}
// フォームから回答を取得する時呼び出される関数

// 汎用pushメッセージ送信関数
var USER_ID = PropertiesService.getScriptProperties().getProperty('USER_UKI');
function pushMessage(sendtxt) {
  var postData = {
    'to': USER_ID,
    'messages': [{
      'type': 'text',
      'text': sendtxt
    }]
  };
  var url = line_pushmsg;
  var headers = {
    'Content-Type' : 'application/json; charset=UTF-8',
    'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
  };
  var options = {
    'method' : 'post',
    'headers': headers,
    'payload': JSON.stringify(postData)
  };
  var response = UrlFetchApp.fetch(url, options);
}


// lineからwebhookによってHTTP/POST送信を受けるメソッド
// それぞれのトリガーを記述し、処理は関数で別ブロックに記述する
function doPost(e) {
  //中身がわからなかったので、loggingで取得している
  //logging(JSON.stringify(e));
  //logging(e.parameter[keys]);
  var json = JSON.parse(e.postData.contents);
  //logging(json);
  //返信するためのトークン取得
  var reply_token = json.events[0].replyToken;
  //無効な中身(トークン)であった場合、終了処理
  if (typeof reply_token === 'undefined') {
    logging('undefined is true');
    return;
  }
  //端末からの送信内容を取得
  var message = json.events[0].message.text;
  //logging(message);
  //送信内容から返信を選定
  var reply_message;
  var help_message = 
  'Todoボットです！\n曜日？\nゴミの日？\n入力？\n検索？[todo内容]\n普段はやまびこします！';

  if (message.match(/ヘルプ/)) {
    reply_message =  help_message;
  } else if (message.match(/曜日？/)) {
    reply_message = wdayReporter();
  } else if (message.match(/ゴミの日？/)) {
    reply_message = gomi_info();
  } else if (message.match(/リスト/)){
    reply_message = todo_list();
  } else if (message.match(/入力？/)){
    reply_message = '↓ のフォームからどうぞ！\n' + Form;
  } else if (message.match(/検索？/)) {
    reply_message = searchTodo(message);
  } else {
    //文字列マッチしなかった場合、デフォルト動作としてオウム返しする
    reply_message = message + ' ですか？';
  }
  //返信内容を作成
  var postData = {
    'replyToken': reply_token,
    'messages': [{
      'type': 'text',
      'text': reply_message
    }]
  };
  var headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
  };
  var options = {
    'method' : 'post',
    'headers': headers,
    'payload': JSON.stringify(postData)
  };
  //google apps scriptのコマンド(URLへアクセスして情報を送信している)
  UrlFetchApp.fetch(line_endpoint, options);
  //これもgoogleapps scritpt のコマンド(テキストを返している)
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}

//Post,Push双方で使える機能　Start
//曜日取得
function put_weekday (gap) {
  var ary = ['日','月','火','水','木','金','土'];
  var week_no = new Date().getDay() + gap;
  return ary[week_no];
}
function wday_talk () {
  var replyword = '今日は' + put_weekday(0) + '曜日です';
  if (replyword.match(/金/)) {
    replyword += '\nプレミアムフライデー？';
  }
  return replyword;
}
function gomi_info () {
  var nextday = put_weekday(1);
  var list = gomi_ss.getDataRange().getValues();
  //objectはsheetへのログ出力ができないので、json化するか
  //logging(JSON.stringify(list));
  //Logger.log(list);
  var gomi_kind = list[1][list[0].indexOf(nextday)];
  //logging(gomi_kind);
  var message = '明日のゴミ種別は' + gomi_kind + 'です！';
  return message;
}
//フォームに入れたリストを表示
function todo_list () {
  var tododata = todo_ss.getDataRange().getValues();
  var result = '';
  if (tododata !== '') {
    for(var i=1;i<tododata.length;i++){
      result += tododata[i][1] + ' (' + tododata[i][2] + ')\n';
    }
    //半角も全角も１文字なので、改行コードを削るのに-1となる
    result = result.slice(0,-1);
    //logging(result);
  } else {
    result = 'no data';
  }
  return result;
}
//sheetからvalの文字列マッチを列で行う
//array[]が行でarrayのインデックスが列となる
function findRow(sheet,val){
  var list = sheet.getDataRange().getValues();
  var hoge = list.some(function(array, i, list){
   return (array[1] === val);});
  //logging (hoge);
  return hoge;
}
function searchRow(sheet,val){
  var list = sheet.getDataRange().getValues();
  var hitflag = false;
  //Logger.log('${val}');
  if (list !== '') {
    for(var i=1;i<list.length;i++){
      if (list[i][1].match(val)) {
        hitflag = true;
        //Logger.log('hit!');
      }
    }
    return hitflag;
  }
}
//検証用に関数だけ実行させるためデバッグ用関数
function devexec(){
  searchTodo('検索？生きる');
}
//Post,Push双方で使える機能　End

// pushメッセージ関数
// 曜日を知らせる
function wdayReporter() {
  var message = wday_talk();
  pushMessage(message);
} 
// ゴミの日を知らせる
function gomiReporter() {
  var message = gomi_info();
  pushMessage(message);
}
// todoを検索する
function searchTodo(message){
  //Logger.log(message);
  var word = message.slice(3,message.length);
  // 検索単語完全一致
  //var word = findRow(todo_ss,word);
  var result = searchRow(todo_ss,word);
  //Logger.log(result);
  if (result) {
    return 'ありました！';
  } else {
    return 'みつかりません...';
  }  
}

