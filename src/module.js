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

      //  this.dashboard.refresh();

      }, err => {
        this.writing = false;
        console.log( "ERROR", err );
        this.error = err.data.error + " ["+err.status+"]";
      });
    });
  }

  onButtonClicked( field, value ) {
    var line = this.panel.measurment + ",who=\"" + this.contextSrv.user.email + '"';
    if(field != null) {
      line = line + "," + field +"=\"" + value + "\""; // TODO?? support numbers?
    }

    this.writeData(line);
  }
}
ButtonPanelCtrl.templateUrl = 'module.html';

export {
  ButtonPanelCtrl as PanelCtrl
};


