import config from 'app/core/config';
import appEvents from 'app/core/app_events';

import {PanelCtrl} from  'app/plugins/sdk';

import _ from 'lodash';
import moment from 'moment';


class ButtonPanelCtrl extends PanelCtrl {
  constructor($scope, $injector, $q, $rootScope, $timeout, $http, contextSrv, timeSrv) {
    super($scope, $injector);
    this.datasourceSrv = $injector.get('datasourceSrv');
    this.injector = $injector;
    this.q = $q;
    this.$timeout = $timeout;
    this.$rootScope = $rootScope;
    this.$http = $http;
    this.contextSrv = contextSrv;
    this.timeSrv = timeSrv;
    this.working = false;

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
  }

  onInitEditMode() {
    // All influxdb datasources
    this.dbs = [];
    _.forEach(config.datasources, (val, key) => {
      if ("influxdb" == val.type) {
        if(key == config.defaultDatasource) {
          this.dbs.unshift(key);
        }
        else {
          this.dbs.push(key);
        }
      }
    });

    this.addEditorTab('Options', 'public/plugins/natel-button-panel/editor.html',1);
    this.editorTabIndex = 1;
  }

  writeData(line) {
    console.log( "WRITE", this.line );
    this.writing = true;
    this.error = null;
    return this.datasourceSrv.get(this.panel.datasource).then( (ds) => {
      this.$http({
        url: ds.urls[0] + '/write?db=' + ds.database,
        method: 'POST',
        data: line,
        headers: {
          "Content-Type": "plain/text"
        }
      }).then((rsp) => {
        this.writing = false;
        this.$rootScope.appEvent('alert-success', [line.replace(',', '\n\n') ]);
        this.timeSrv.setTime(this.timeSrv.time);
        console.log( "OK", rsp );
        return 'OK';
      }, err => {
        this.writing = false;
        console.log( "ERROR", err );
        this.error = err.data.error + " ["+err.status+"]";
      });
    });
  }

  onButtonClicked( field, value ) {
    this.working = true;

    var line = this.panel.measurment + ",who=\"" + this.contextSrv.user.email + '"';
    if(field != null) {
      line = line + "," + field +"=\"" + value + "\""; // TODO?? support numbers?
    }

    this.writeData(line).then( () => {
      if(!_.isNil( this.panel.slackurl ) ) {
        return this.datasourceSrv.get(this.panel.datasource).then( (ds) => {
          var q = 'SELECT  "who","computer" FROM "current" WHERE "product" = \''+value+'\'';
          ds._seriesQuery( q ).then( (res)=> {
            var info = '';
            _.forEach(res.results, (s)=> {
              _.forEach(s.series, (r)=> {
                _.forEach(r.values, (v)=> {
                  info += '<@'+v[1]+'> '+ v[2] + '\n';
                });
              });
            });

            var name = this.contextSrv.user.email.substring(0, this.contextSrv.user.email.indexOf('@'));
            var data = {
              "text":  "<@"+name+"> wants a license for *"+value+"*", 
              "username": "nx-license-bot-"+value, 
              "icon_emoji": ":monkey_face:",
              "attachments": []
            };

            if(!_.isNil(this.broadcastmsg)) {
              data.attachments.push( {
                "title": this.broadcastmsg,
                "color": "#b5052e"
              });
              this.broadcastmsg = null;
            }

            if(info.length > 0) {
              data.attachments.push( {
                "title": "Current Licenses",
                "title_link": "http://hangar-controls:3000/dashboard/db/license-info-nx",
                "text": info,
                "color": "#e2a522"
              });
            }

            this.$http({
              data: JSON.stringify(data),
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': undefined
              },
              method: 'POST',
              url: this.panel.slackurl
            }).then((rsp) => {
              console.log( "Notificatoin sent", rsp );
              this.$rootScope.appEvent('alert-success', ['Slack Notificatoin Sent']);
              this.working = false;
            }, err => {
              console.log("Error sending slack", err);
              this.$rootScope.appEvent('alert-error', ['Slack Notification', err]);
              this.working = false;
            });
          });
        });
      }
      else {
        this.working = false;
      }
    });
  }
}
ButtonPanelCtrl.templateUrl = 'module.html';

export {
  ButtonPanelCtrl as PanelCtrl
};


