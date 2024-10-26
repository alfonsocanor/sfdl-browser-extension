/*global chrome*/
import { track, api, LightningElement  } from 'lwc';
import { showToastEvent, setKeyValueLocalStorage } from 'sfdl/utils';
import { css } from './logListCss';

const APEX_LOG_IDS_QUERY_URL = '/services/data/v51.0/tooling/query/?q=';
const APEX_LOG_IDS_QUERY_URL_SELECT_FROM = 'SELECT Id, LastModifiedDate, LogLength, LogUser.Name, Operation, Status FROM ApexLog ';
const APEX_LOG_IDS_QUERY_URL_ORDER_BY = ' ORDER BY LastModifiedDate DESC';
const KEYBOARD_ARROW_UP_CODE = 38;
const KEYBOARD_ARROW_DOWN_CODE = 40;

const processResponseBasedOnContentType = {
    httpError(response){
        return {hasError: true, error: response.error, message: response.message};
    },
    async contentTypeJson(response){
        const logsInformation = await response.json()
        return logsInformation.records.map(logRecord => logRecord);
    },
    async contentTypeText(response, logId, fileName){
        let newResponse = response.clone();
        let blob = new Blob([newResponse.text()], {
            type: 'text/html'
        });
        console.log('blobsize: ' + blob.size); 
        return {id:logId, name:fileName, response:response.text()};
    }
}

export default class LogList extends LightningElement{
    @api sessionInformation;
    @api isAnaliseLogs = false;
    @api isCompareLogs = false;
    @api logs2Compare = [];
    totalLogsCompletelyRetrieved = 0;

    @track logList = [];
    
    thereAreLogsToDisplay = false;
    isDownloading;
    firstRender = true;

    closeIcon = '/slds/icons/utility/close.svg';

    compareLogsColumns2LogDetails = {
        column1:{id:'',logName:'', logDetails:''},
        column2:{id:'',logName:'', logDetails:''}
    }

    totalLogsToDownload = 0;

    retrivingLogsInProgress = false;
    downloadAllLogsActivated = false;
    downloadInProgress;

    index4NavigationFocusOn;

    connectedCallback(){
        if(this.isAnaliseLogs){
            this.getApexLogsInformation(this.sessionInformation);
        } else if(this.isCompareLogs){
            this.logList = this.logs2Compare;
        }
    }

    renderedCallback() {
        this.initializeCustomCss();
    }
    
    initializeCustomCss() { 
        // Check if the custom CSS is already loaded
        if (!document.adoptedStyleSheets.some(sheet => sheet instanceof CSSStyleSheet && sheet.replaceSync === css.replaceSync)) {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(css);
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        }
    }

    showAllLogs() {
        this.template.querySelectorAll('.slds-item').forEach(element => {
            console.log('here');
            element.classList.remove('custom-animation');
        });
    }

    saveFirstAndLastLogIdsFromLogList(){
        this.firstLogId = this.logList[0].id;
        this.lastLogId = this.logList[this.logList.length - 1].id;
    }

    handleLogInfo(event){
        if(this.isAnaliseLogs){
            this.logInfoAnalyseLogs(event);
        } else  if(this.isCompareLogs){
            this.logInfoCompareLogs(event);
        }
    }

    async logInfoAnalyseLogs(event){
        this.logDetailProcessing();
        this.setIndexFocusFromOnClickLogSelection(event);
        this.removeboxShadowForAllTheLogDetails();
        this.boxShadowForTheLogDetailSelected(event, '0 0 0 3px #006bff40');

        let logDetails = this.getLogByIdFromLogList(event.target.dataset.logid);

        if(!logDetails.response) {
            await this.processApexLog(this.sessionInformation, logDetails);
        }

        this.dispatchEvent(new CustomEvent('logdetails',{
            detail: { 
                logName: event.target.dataset.logname,
                logDetails: logDetails
            }
        }))
    }

    logDetailProcessing(){
        this.dispatchEvent(new CustomEvent('isloading',{
            detail: {}
        }))
    }

    getLogByIdFromLogList(logId){
        return this.logList.find(log => log.id === logId);
    }

    async getLogInformation(event){
        const response = this.logList.filter(log => {
            return log.id === event.target.dataset.logid
        });
        const logDetails = await response[0].response;
        const logName = event.target.dataset.logname;

        return { logDetails, logName }
    }

    logInfoCompareLogs(event){
        let wasUnselected = this.unselectLogs2Compare(event);
        
        if(!wasUnselected){
            this.selectLogs2Compare(event);
        }
    }

    async selectLogs2Compare(event){
        const logInfo = await this.getLogInformation(event);
        if(this.bothLogs2CompareSelected()){
            this.updateCompareLogsColumns2LogDetails('column1', event.target.dataset.logid, logInfo.logName, logInfo.logDetails);
            this.boxShadowForTheLogDetailSelected(event, '0 0 0 3px #006bff40');
        } else {
            for(const log2Compare in this.compareLogsColumns2LogDetails){
                if(!this.compareLogsColumns2LogDetails[log2Compare].id){
                    this.updateCompareLogsColumns2LogDetails(log2Compare, event.target.dataset.logid, logInfo.logName, logInfo.logDetails);
                    this.boxShadowForTheLogDetailSelected(event, '0 0 0 3px #006bff40');
                    break;
                }
            }
        }

    }

    bothLogs2CompareSelected(){
        for(const log2Compare in this.compareLogsColumns2LogDetails){
            if(!this.compareLogsColumns2LogDetails[log2Compare].id){
                return false;
            }
        }
        return true;
    }

    updateCompareLogsColumns2LogDetails(columnNumber, logId, logName, logDetails){
        this.compareLogsColumns2LogDetails[columnNumber].id = logId;
        this.compareLogsColumns2LogDetails[columnNumber].logName = logName;
        this.compareLogsColumns2LogDetails[columnNumber].logDetails = logDetails;
    }

    unselectLogs2Compare(event){
        for(const log2Compare in this.compareLogsColumns2LogDetails){
            if(this.bothLogs2CompareSelected()){
                this.template.querySelectorAll('.displayLogButton').find(element => element.dataset.logid === this.compareLogsColumns2LogDetails.column2.id).style.boxShadow = 'none';
                this.compareLogsColumns2LogDetails.column2.id = '';
                this.compareLogsColumns2LogDetails.column2.logName = '';
                this.compareLogsColumns2LogDetails.column2.logDetails = '';        
            } else if(this.compareLogsColumns2LogDetails[log2Compare].id === event.target.dataset.logid){
                this.compareLogsColumns2LogDetails[log2Compare].id = '';
                this.compareLogsColumns2LogDetails[log2Compare].logName = '';
                this.compareLogsColumns2LogDetails[log2Compare].logDetails = '';
                this.boxShadowForTheLogDetailSelected(event, 'none');
                return true
            }
        }

        return false;
    }

    boxShadowForTheLogDetailSelected(event, color){
        event.target.style.boxShadow = color;
        event.target.style.outline = '-webkit-focus-ring-color auto 1px';
        event.target.focus();
    }
    removeboxShadowForAllTheLogDetails(){
        this.template.querySelectorAll('.displayLogButton').forEach(element => {
            element.style.boxShadow = 'none';
            element.style.outline = 'none';

        });
    }

    async getApexLogsInformation(sessionInformation) {
        let url2GetApexLogIds = sessionInformation.instanceUrl +
            APEX_LOG_IDS_QUERY_URL + APEX_LOG_IDS_QUERY_URL_SELECT_FROM +
            (sessionInformation.queryWhere ? sessionInformation.queryWhere : APEX_LOG_IDS_QUERY_URL_ORDER_BY);
        const apexLogList = await this.getInformationFromSalesforce(url2GetApexLogIds, {}, sessionInformation, 'contentTypeJson');

        if(apexLogList.response.hasError){
            this.enableSearchQueryIcon();
            showToastEvent('error', apexLogList.response.error, apexLogList.response.message);
            return;
        }

        if(apexLogList.response.length){
            this.thereAreLogsToDisplay = true;
            let logResponse = await this.getApexLogList(apexLogList.response);
            this.logList = logResponse.apexLogList;
            this.disableDownloadButton(false)
            showToastEvent('success', 'Let\'s start the analysis (:', sessionInformation.instanceUrl);
            setTimeout(() => {
                this.showAllLogs();
            }, 500);
        } else {
            this.thereAreLogsToDisplay = false;
            showToastEvent('info', 'There are no logs to retrieve', sessionInformation.instanceUrl);
        }

        this.enableSearchQueryIcon();
    }

    getApexLogList(apexLogList) {
        return chrome.runtime.sendMessage({
            message: "getApexLogList", apexLogList
        });
    }

    enableSearchQueryIcon(){
         this.dispatchEvent(new CustomEvent('enablepicklistbuttons',{
            detail:{}
        }))
    }


    async getInformationFromSalesforce(requestUrl, additionalOutputs, sessionInformation, function2Execute, logId) {
            const response = await this.fetchLogsRecords(requestUrl,sessionInformation, function2Execute, logId, additionalOutputs.fileName);
            return {response, additionalOutputs};
    }

    async fetchLogsRecords(requestUrl, sessionInformation, function2Execute, logId, fileName){
        let response = {}; 
        try{
            response = await fetch(requestUrl,{
                method:'GET',
                headers: {
                    'Authorization': 'Bearer ' + sessionInformation.authToken,
                    'Content-type': 'application/json; charset=UTF-8; text/plain',
                }
            });

            if(response.status === 400) {
                function2Execute = 'httpError';
                response.error = 'Invalid query :('; 
                response.message = requestUrl.split('q=')[1];
            } else if (response.status === 401) {
                function2Execute = 'httpError';
                response.error = 'Invalid session :('; 
                response.message = sessionInformation.instanceUrl;
                response.message = response.status === 401 ? response.statusText + ': Invalid session' : response.message;
            } else if (response.status !== 200) {
                function2Execute = 'httpError';
                response.error = 'Error :('; 
                response.message = response.statusText;
            }
        } catch(e){}

        return processResponseBasedOnContentType[function2Execute](response, logId, fileName);
    }

    async processApexLog(sessionInformation, apexLog) {
        let message = await chrome.runtime.sendMessage({
            message: "downloadApexLog", 
            sessionInformation, apexLog
        });

        let apexLog2Update = this.logList.find( log => log.id === message.apexLogWithBody.response.id);

        apexLog2Update.response = message.apexLogWithBody.response.response;
    }

    async processApexLogs(sessionInformation, apexLogList) {
        setKeyValueLocalStorage('isDownloadInProgress', true);
        this.totalLogsToDownload = apexLogList.length;
        this.retrivingLogsInProgress = true;
        this.downloadProgressBar();

        let message = await chrome.runtime.sendMessage({
            message: "downloadApexLogs", 
            sessionInformation, apexLogList
        });

        if(message.logsDownloaded){
            this.retrivingLogsInProgress = false;
            setTimeout(() => {
                this.disableDownloadButton(true);
            }, 200);
            this.getLogsDownloadedFromWorkerBackground();
        }
    }

    async getLogsDownloadedFromWorkerBackground(){
        let message = await chrome.runtime.sendMessage({
            message: "getLogsDownloaded"
        });

        this.logList.find( apexLog => apexLog.id === message.batchLogs2Producess[0].id) //this.logList.concat(message.batchLogs2Process);

        return message.continueProcess ? 
            this.getLogsDownloadedFromWorkerBackground() : //recursion
            this.logsProcessedResults();
    }

    logsProcessedResults(){
        this.disableDownloadButton(false);
        this.sendLogList2Console(this.logList);

        showToastEvent('success', 'You can use compare now!', 'Compare Logs', true);
        this.enableSearchQueryIcon();
    }

    logName2Display(apexLog){
        return  apexLog.LogUser.Name + ' | ' + 
                this.createOperationFormat(apexLog.Operation) + ' | ' +
                apexLog.LogLength + 'bytes | ' +
                this.createDatetimeFormat(new Date(apexLog.LastModifiedDate));
    }

    createOperationFormat(operation){
        let regex = new RegExp('/', 'g');

        if(operation.includes('__')){
            return operation.replace(regex, '').split('__')[1];
        }

        return operation.replace(regex, '');
    }

    createDatetimeFormat(date){
        return  this.padNumberValues(date.getDay(), 2,'0') + '/' +
                this.padNumberValues(date.getMonth(), 2, '0') + ' ' +
                this.padNumberValues(date.getHours(), 2, '0') + 'h' + 
                this.padNumberValues(date.getMinutes(), 2, '0') + 'm' +
                this.padNumberValues(date.getSeconds(), 2, '0') + 's';
    }

    padNumberValues(numberValue, padLength, padString){
        return numberValue.toString().padStart(padLength, padString);
    }

    handleOpenCloseSfdlDownload(){
        this.totalLogsToDownload = this.logList.length;
        this.isDownloading = !this.isDownloading;
    }

    disableDownloadButton(isDisable){
        this.template.querySelector('.downloadLogsButton').disabled = isDisable;
    }

    @api
    handleManipulationOptionsForDownloading(manipulationOptions){
        this.manipulationOptions = manipulationOptions;
    }

    downloadinprogress2compare(){
        this.dispatchEvent(new CustomEvent('downloadinprogress2compare',{
            detail: true
        }));
    }

    sendLogList2Console(logList){
        this.dispatchEvent(new CustomEvent('sendloglist',{
            detail:{ logList }
        }));
    }

    async downloadProgressBar(){
        let currentValue = await chrome.runtime.sendMessage({message: "downloadProgressBar"});

        const sfdlProcessBar = this.template.querySelector('sfdl-process-bar');

        if(sfdlProcessBar){
            this.template.querySelector('sfdl-process-bar').updateProgressBar(currentValue.totalLogsCompletelyRetrieved);
        }

        return currentValue.totalLogsCompletelyRetrieved === this.totalLogsToDownload ? 
            currentValue.totalLogsCompletelyRetrieved : this.downloadProgressBar();
    }

    handleDownloadProgress(event) {
        const sfdlProcessBar = this.template.querySelector('sfdl-process-bar');

        if(sfdlProcessBar){
            this.template.querySelector('sfdl-process-bar').updateProgressBar(event.detail.logsDownloaded);
        }
    }

    onKeyArrowsPressed(event){
        this.preventDefault(event);
        if(event.keyCode === 38 || event.keyCode === 40){
            this.logListNavigation(event);
        }
    }

    logListNavigation(event){    
        let keyUp = event.keyCode === KEYBOARD_ARROW_UP_CODE;
        let keyDown = event.keyCode === KEYBOARD_ARROW_DOWN_CODE;
        
        let itemSelected = this.template.querySelectorAll('.logList');

        if(this.index4NavigationFocusOn === 0 && keyUp){
            this.index4NavigationFocusOn = itemSelected.length - 1;
        } else if(this.index4NavigationFocusOn === itemSelected.length - 1 && keyDown){
            this.index4NavigationFocusOn = 0;
        } else {
            this.index4NavigationFocusOn = keyUp ? this.index4NavigationFocusOn - 1  : this.index4NavigationFocusOn + 1;
        }

        let eventObject = {
            target:itemSelected[this.index4NavigationFocusOn]
        }

        this.logInfoAnalyseLogs(eventObject); 
    }

    preventDefault(event){
        event.preventDefault();
    }

    setIndexFocusFromOnClickLogSelection(event){
        let logList = this.template.querySelectorAll('.logList');
        for(const index in logList){
            if(logList[index].dataset.logid === event.target.dataset.logid){
                this.index4NavigationFocusOn = Number(index);
                return;
            }
        }
    }

    cancelDownload() {
        this.template.querySelector('sfdl-download-logs').cancelDownload();
        this.isDownloading = false;
        showToastEvent('warning', 'sfdl', 'Download cancelled!');
    }
}