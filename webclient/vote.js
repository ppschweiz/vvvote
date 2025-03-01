function VotePage() {
	Page.call(this);
	this.steps = new Array();
	this.steps[1] = 'Schritt 1: Wahlunterlagen holen'; 
	this.steps[2] = 'Schritt 2: Autorisierung';
	this.steps[3] = 'Schritt 3: Abstimmen';
	this.mainContent = '<h3>Wahlunterlagen holen</h3>'+
	'<p><ul><li>Ich habe noch keinen Wahlschein</li>' +
	'<li>f&uuml;r die Wahl wird kein Wahlschein ben&ouml;tigt</li>' +
	'<li>Ich wei&szlig; nicht, ob f&uuml;r die Wahl ein Wahlschein ben&ouml;tigt wird</li></ul>' +
	GetElectionConfig.getMainContent('Wahlunterlagen holen', 'page', 'VotePage.prototype.gotElectionConfig') + '</p>' + 
	'<p></p>&nbsp;<p></p>' +
	'<h3>Ich habe bereits einen Wahlschein</h3>' + 
	BlindedVoterElection.loadReturnEnvelopeHtml('page.blinder');
	this.title = 'An Abstimmung teilnehmen';
	this.reset();
	VotePage.obj = this; // set a reference to this instance so that it can be called from static methods
}


VotePage.prototype = new Page();

VotePage.prototype.reset = function() {
	this.config = {};
	this.blinder = {};
	this.tally = {};
	this.authModule = {};
	this.displayPermFileHtmlOnPhase2 = false;
	this.authFailed = false;
};

VotePage.prototype.display = function() {
	this.reset();
	Page.prototype.display.call(this);
	if (typeof returnEnvelope != 'undefined') {
		BlindedVoterElection.onImportPermission(returnEnvelope);
		// this.gotElectionConfig(returnEnvelope.config);
	}

};


/*
function startVoting(load) {
		election = new BlindedVoterElection('election', permissionLoaded); // use global namespace because
		if (load) {loadMainContent(mc); }
		return mc;
	}
 */


VotePage.prototype.gotElectionConfig = function (config) { 
	this.config = config; 
	// config.phase = 'generatePermissions'; // TODO take phase from config
	// this was for debugging: this.getNextVoteTime("2015-04-13T12:41:00+02:00");
	// TODO if we have phases that do not overlap care about these:
	if (this.isRegPhase()) config.phase = 'generatePermissions'; 
	else alert('Es ist nicht mehr möglich, einen Wahlschein zu erstellen');
	switch (config.phase) {
	case 'generatePermissions':
		this.startStep2(config);
		break;
	case 'voting':
		this.startStep3(config, true);		
	}
};

VotePage.prototype.startStep2 = function (config) {
	var mc = '';
	var techinfo = '';
	this.config = config;
	switch (config.blinding) {
	case 'blindedVoter':
		mc = mc + BlindedVoterElection.getStep2Html();
		techinfo =  BlindedVoterElection.getStep2HtmlDetails();
		this.blinder = new BlindedVoterElection(config);
		break;
	default:
		alert('The election requieres election module >' + config.blinding + "< which is not supported by this client.\nUse a compatible client.");
	break;			
	}
	
	mc = mc + '<div id="auth">' +
	'<form onsubmit="return false;">' +
	'                       <br>' +
	'						<h3><label for="electionId">Name der Abstimmung:</label> ' +
	'                            <span id="electionId">' + config.electionTitle + '</span></h3>'+		
//	'						<label for="electionId">Name der Abstimmung:</label> ' +
//  '                            <input readonly="readonly" name="electionId" id="electionId" value="' + config.electionId + '">' + // TODO use element.settext for election (instead of escaping electionId) 
    '                            <input type="hidden" readonly="readonly" name="electionId" id="electionId" value="' + config.electionId + '">' + // TODO use element.settext for election (instead of escaping electionId) 
    '                       <br>';


	switch (config.auth) {
	case 'userPassw':
		mc = mc + UserPasswList.getMainContent(config);
		this.authModule = new UserPasswList();
		break;
	case 'sharedPassw':
		mc = mc + SharedPasswAuth.getMainContent(config);
		this.authModule = new SharedPasswAuth();
		break;
	case 'oAuth2':
		mc = mc + OAuth2.getMainContent(config);
		this.authModule = new OAuth2(config.authConfig);
		break;
	case 'externalToken':
		mc = mc + ExternalTokenAuth.getMainContent(config);
		this.authModule = new ExternalTokenAuth(); 
		break;
	default:
		alert('The election requieres authorisation module >' + config.auth + "< which is not supported by this client.\nUse a compatible client.");
	}
	var showGenerateButton = '""';
	if (this.authModule.hasSubSteps) showGenerateButton = '"display:none;"';
	mc = mc + // TODO take this or some part of it from blinder module
	'<div id="substepL" style=' +showGenerateButton + '>' +
	'						<label for="reqPermiss"></label> ' +
	'						     <input type="submit" name="reqPermiss" id="reqPermiss" ' +
	'							  value="Wahlschein erzeugen und speichern" onclick="page.onGetPermClick();">' +
    '                       <br>' +
    '</div>' +
    '</form>' +
    '</div>';

	this.setStep(2); // setStep deletes additional tech infos
	Page.loadMainContent(mc);
	Page.setAddiTechInfos(techinfo);
};

VotePage.prototype.onGetPermClick = function () { 
	this.blinder.onGetPermClick(this.authModule, this.authFailed);
};

VotePage.prototype.onAuthFailed = function(curServer) {
	this.authFailed = true;
	this.authModule.onAuthFailed(curServer);
};


VotePage.prototype.onPermGenerated = function() {
	this.setStep(3);
	var mc = this.blinder.getPermGeneratedHtml();
	Page.loadMainContent(mc);
	Page.setAddiTechInfos(BlindedVoterElection.getStep3HtmlDetails());
};



VotePage.prototype.onPermLoaded = function(permok, blindingobj, config, returnEnvelopeLStorageId) {
	this.blinder = blindingobj;
	this.config = this.blinder.config;

	if (permok) {
		switch (config.tally) {
		case 'publishOnly': 
			this.tally = new PublishOnlyTally(this.blinder, config);
			break;
		case 'configurableTally':
			this.tally = new ConfigurableTally(this.blinder, config);
			break;
		default:
			alert('Abstimmunsmodus /' + config.tally + '/ wird vom Client nicht unterstützt');
		}
		var fragm = document.createDocumentFragment(); 

			// print election title
			var elp = document.createElement('h1');
			elp.appendChild(document.createTextNode(config.electionTitle));
			elp.setAttribute('id', 'ballotName');
			fragm.appendChild(elp);
			
			// print voting period
			var periodText = page.getVoteTimeStr();
			var elp = document.createElement('p');
			elp.appendChild(document.createTextNode(periodText));
			elp.setAttribute('class', 'votingPeriod');
			fragm.appendChild(elp);

			// get from Tally
			fragm = this.tally.getMainContentFragm(fragm, config);
		Page.loadMainContentFragm(fragm);
		this.tally.onPermissionLoaded(returnEnvelopeLStorageId); 
//		var element = document.getElementById('sendvote');
//		element.disabled = !permok;
		this.setStep(3);

	} else {
		alert('Wahlschein nicht gültig'); // TODO provide a more detailed error message
	}
	
	// check if working as return envelope and directly opend or saved (only needed for firefox)
	if (typeof returnEnvelope != 'undefined') {
		var now = new Date();
		if (this.blinder.returnEnvelopeCreationDate.getTime() + 60000 > now.getTime() ) {// it took less than 60 seconds from creation to opening the return envelope, so it is very likely that it was not saved but directly opened
			// check browser (only firefox offers directly opening instead of saving
			var parser = new UAParser(); 
			var browser = parser.getBrowser();
			if ( browser.name.toUpperCase().indexOf('FIREFOX') >= 0) {
				// if 'temp' or 'tmp' is in the file path, request the user to save it in a real not temporary place
				if (location.href.toUpperCase().indexOf('TEMP') >= 0 || location.href.toUpperCase().indexOf('TMP') >= 0 ) {
					showPopup(html2Fragm('Sie haben den Wahlschein direkt geöffnet. Sie müssen ihn aber als Datei auf Ihrem Gerät speichern. ' +
							'<button onclick="removePopup(); page.blinder.saveReturnEnvelopeAgain();" autofocus="autofocus">Ok</button>'));
				}
			}		
		}
	}


};

VotePage.prototype.sendVote = function (event) {
	// alert('jetzt wird die Stimme gesendet');
	this.tally.sendVote(event);
};

VotePage.prototype.isRegPhase = function() {
	var regStart = new Date("2000-01-01T00:00:00+00:00");
	if ('RegistrationStartDate' in this.config.authConfig) regStart = new Date(this.config.authConfig.RegistrationStartDate); 
	var regEnd = new Date("3000-01-01T00:00:00+00:00"); // use 1.1.3000 as enddate if no enddate is configured
	if ('RegistrationEndDate' in this.config.authConfig) regEnd = new Date(this.config.authConfig.RegistrationEndDate); 
	var now = new Date(); //now
	var regPhase = false;
	if ( (regStart <= now) && (regEnd >= now) ) regPhase = true;
	return regPhase;
};

VotePage.prototype.isVotePhase = function() {
	var regStart = new Date("2000-01-01T00:00:00+00:00");
	if ('VotingStart' in this.config.authConfig) regStart = new Date(this.config.authConfig.VotingStart); 
	var regEnd = new Date("3000-01-01T00:00:00+00:00"); // use 1.1.3000 as enddate if no enddate is configured
	if ('VotingEnd' in this.config.authConfig) regEnd = new Date(this.config.authConfig.VotingEnd); 
	var now = new Date(); //now
	var regPhase = false;
	if ( (regStart <= now) && (regEnd >= now) ) regPhase = true;
	return regPhase;
};

VotePage.prototype.isShowResultPhase = function() {
	var regEnd = new Date(this.config.authConfig.VotingEnd); // "2015-04-12T02:22:00Z");
	var now = new Date(); //now
	var regPhase = false;
	if (regEnd <= now) regPhase = true;
	return regPhase;
};

/**
 * 
 * @param returnEnvelpeCreationDate
 * @returns true if voting is allowed now, <br>
 * 			a Date if voting will be allowed from that date on or <br> 
 * 			false if voting is not possible anymore 
 */
VotePage.prototype.getNextVoteTime = function() {
	//var returnEnvelpeCreationDateStr = this.blinder.returnEnvelpeCreationDate;
	var now = new Date();
	var endDate = new Date("3000-01-01T00:00:00+00:00"); // use 1.1.3000 as enddate if no enddate is configured
	if ('VotingEnd' in this.config.authConfig)	endDate = new Date (this.config.authConfig.VotingEnd);
	if (now >= endDate) return false;
	
	var startDate = new Date("2000-01-01T00:00:00+00:00"); // use 1.1.3000 as startdate if no enddate is configured
	if ('VotingStart' in this.config.authConfig)	startDate = new Date (this.config.authConfig.VotingStart);
	
	var endRegDate = new Date("3000-01-01T00:00:00+00:00"); // use 1.1.3000 as enddate if no enddate is configured
	if ('RegistrationEndDate' in this.config.authConfig)	endRegDate = new Date (this.config.authConfig.RegistrationEndDate);
	
	if (startDate > endRegDate) { // if registration phase and voting phase do not overlapp 
		if (now <  startDate) return startDate; // and voting did not start yet, return votingStartDate
	    if (now >= startDate)  return true;
	}

	// Voting and registering phase overlap
	if ( ! ('DelayUntil' in this.config.authConfig) ) return true; // this way of delaying is not configured, so allow
	var returnEnvelopeCreationDate = this.blinder.returnEnvelopeCreationDate;; // "2015-04-12T02:22:00Z");
	var i = 0;
	var curDelayUntil;
	do {
		curDelayUntil = new Date(this.config.authConfig.DelayUntil[i]);
		i++;
	} while ((curDelayUntil < returnEnvelopeCreationDate) && (i < this.config.authConfig.DelayUntil.length));
	if (curDelayUntil <=  returnEnvelopeCreationDate) return false; // there is no DelayUntil after returnEnvelopeCreationDate --> no chance to cast the vote 
	if (curDelayUntil <= now) return true;  // the delay after the returnEnvelpeCreationDate is already fulfilled 
	return curDelayUntil;
};

// executeAt(time, obj, method);


VotePage.prototype.getVoteTimeStr = function() {
	var startdate = this.getNextVoteTime();
	var enddate = false;
	if ('VotingEnd' in this.config.authConfig) enddate = new Date (this.config.authConfig.VotingEnd);
	var now = new Date();
	var votingTimeStr = 'Fehler r83g83';
	if (startdate === true) {
		if (enddate === false) votingTimeStr = 'Ab sofort können Sie Ihre Stimme ohne zeitliche Einschränkung abgeben.';
		if (enddate >= now) votingTimeStr = 'Ab sofort bis vor ' + formatDate(enddate) + ' Uhr können Sie Ihre Stimme abgeben.';
	}
	if (startdate instanceof Date) votingTimeStr = 'Von ' + formatDate(startdate) + ' Uhr bis vor ' + formatDate(enddate) + ' Uhr können Sie Ihre Stimme abgeben.';
	if ( !(enddate === false)) {
		if (startdate === false || enddate <= now)  votingTimeStr = 'Es gibt für Sie keine Möglichkeit mehr, Ihre Stimme abzugeben.';
	}
	return votingTimeStr;
};


