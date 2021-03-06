/*
 * Copyright 2012 LinkedIn Corp.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

$.namespace('azkaban');

var logModel;
azkaban.LogModel = Backbone.Model.extend({});

var jobLogView;
azkaban.JobLogView = Backbone.View.extend({
	events: {
		"click #updateLogBtn" : "handleUpdate"
	},
	initialize: function(settings) {
		this.model.set({"offset": 0});
		this.handleUpdate();
	},
	handleUpdate: function(evt) {
		var requestURL = contextURL + "/executor"; 
		var model = this.model;
		var finished = false;

		var date = new Date();
		var startTime = date.getTime();
		
		while (!finished) {
			var offset = this.model.get("offset");
			var requestData = {
				"execid": execId, 
				"jobId": jobId, 
				"ajax":"fetchExecJobLogs", 
				"offset": offset, 
				"length": 50000, 
				"attempt": attempt
			};

			var successHandler = function(data) {
				console.log("fetchLogs");
				if (data.error) {
					console.log(data.error);
					finished = true;
				}
				else if (data.length == 0) {
					finished = true;
				}
				else {
					var date = new Date();
					var endTime = date.getTime();
					if ((endTime - startTime) > 10000) {
						finished = true;
						showDialog("Alert","The log is taking a long time to finish loading. Azkaban has stopped loading them. Please click Refresh to restart the load.");
					} 

					var re = /(https?:\/\/(([-\w\.]+)+(:\d+)?(\/([\w/_\.]*(\?\S+)?)?)?))/g;
					var log = $("#logSection").text();
					if (!log) {
						log = data.data;
					}
					else {
						log += data.data;
					}

					var newOffset = data.offset + data.length;
					$("#logSection").text(log);
					log = $("#logSection").html();
					log = log.replace(re, "<a href=\"$1\" title=\"\">$1</a>");
					$("#logSection").html(log);

					model.set({"offset": newOffset, "log": log});
					$(".logViewer").scrollTop(9999);
				}
			}

			$.ajax({
				url: requestURL,
				type: "get",
				async: false,
				data: requestData,
				dataType: "json",
				error: function(data) {
					console.log(data);
					finished = true;
				},
				success: successHandler
			});
		}
	}
});

var summaryModel;
azkaban.SummaryModel = Backbone.Model.extend({});

var jobSummaryView;
azkaban.JobSummaryView = Backbone.View.extend({
	events: {
		"click #updateSummaryBtn" : "handleUpdate"
	},
	initialize: function(settings) {
		this.handleUpdate();
	},
	handleUpdate: function(evt) {
		var requestURL = contextURL + "/executor"; 
		var model = this.model;
		var self = this;

		var requestData = {
			"execid": execId, 
			"jobId": jobId, 
			"ajax":"fetchExecJobSummary", 
			"attempt": attempt
		};

		$.ajax({
			url: requestURL,
			dataType: "json",
			data: requestData,
			error: function(data) {
				console.log(data);
			},
			success: function(data) {
				console.log("fetchSummary");
				if (data.error) {
					console.log(data.error);
				}
				else {
					self.renderCommandTable(data.commandProperties);
					self.renderJobTable(data.summaryTableHeaders, data.summaryTableData, "summary");
					self.renderJobTable(data.statTableHeaders, data.statTableData, "stats");
					self.renderHiveTable(data.hiveQueries, data.hiveQueryJobs);
				}
			}
		});
	},
	renderCommandTable: function(commandProperties) {
		if (commandProperties) {
			var commandTable = $("#commandTable");
			
			for (var i = 0; i < commandProperties.length; i++) {
				var prop = commandProperties[i];
				var tr = document.createElement("tr");
				var name = document.createElement("td");
				var value = document.createElement("td");
				$(name).html("<b>" + prop.first + "</b>");
				$(value).html(prop.second);
				$(tr).append(name);
				$(tr).append(value);
				commandTable.append(tr);
			}
		}
	},
	renderJobTable: function(headers, data, prefix) {
		if (headers) {
			// Add table headers
			var header = $("#" + prefix + "Header");
			var tr = document.createElement("tr");
			var i;
			for (i = 0; i < headers.length; i++) {
				var th = document.createElement("th");
				$(th).text(headers[i]);
				$(tr).append(th);
			}
			header.append(tr);
			
			// Add table body
			var body = $("#" + prefix + "Body");
			for (i = 0; i < data.length; i++) {
				tr = document.createElement("tr");
				var row = data[i];
				for (var j = 0; j < row.length; j++) {
					var td = document.createElement("td");
					if (j == 0) {
						// first column is a link to job details page 
						$(td).html(row[j]);
					} else {
						$(td).text(row[j]);
					}
					$(tr).append(td);
				}
				body.append(tr);
			}
		} else {
			$("#job" + prefix).hide();
		}
	},
	renderHiveTable: function(queries, queryJobs) {
		if (queries) {
			// Set up table column headers
			var header = $("#hiveTableHeader");
			var tr = document.createElement("tr");
			var headers = ["Query","Job","Map","Reduce","HDFS Read","HDFS Write"];
			var i;
			
			for (i = 0; i < headers.length; i++) {
				var th = document.createElement("th");
				$(th).text(headers[i]);
				$(tr).append(th);
			}
			header.append(tr);
			
			// Construct table body
			var body = $("#hiveTableBody");
			for (i = 0; i < queries.length; i++) {
				// new query
				tr = document.createElement("tr");
				var td = document.createElement("td");
				$(td).html("<b>" + queries[i] + "</b>");
				$(tr).append(td);
				
				var jobs = queryJobs[i];
				if (jobs != null) {
					// add first job for this query
					var jobValues = jobs[0];
					var j;
					for (j = 0; j < jobValues.length; j++) {
						td = document.createElement("td");
						$(td).html(jobValues[j]);
						$(tr).append(td);
					}
					body.append(tr);
					
					// add remaining jobs for this query
					for (j = 1; j < jobs.length; j++) {
						jobValues = jobs[j];
						tr = document.createElement("tr");
						
						// add empty cell for query column
						td = document.createElement("td");
						$(td).html("&nbsp;");
						$(tr).append(td);
						
						// add job values
						for (var k = 0; k < jobValues.length; k++) {
							td = document.createElement("td");
							$(td).html(jobValues[k]);
							$(tr).append(td);
						}
						body.append(tr);
					}
					
				} else {
					body.append(tr);
				}
			}
		} else {
			$("#hiveTable").hide();
		}
	}
});

var jobTabView;
azkaban.JobTabView = Backbone.View.extend({
	events: {
		'click #jobSummaryViewLink': 'handleJobSummaryViewLinkClick',
		'click #jobLogViewLink': 'handleJobLogViewLinkClick'
	},

	initialize: function(settings) {
		var selectedView = settings.selectedView;
		if (selectedView == 'joblog') {
			this.handleJobLogViewLinkClick();
		}
		else {
			this.handleJobSummaryViewLinkClick();
		}
	},

	render: function() {
	},

	handleJobLogViewLinkClick: function() {
		$('#jobSummaryViewLink').removeClass('active');
		$('#jobSummaryView').hide();
		$('#jobLogViewLink').addClass('active');
		$('#jobLogView').show();
	},
	
	handleJobSummaryViewLinkClick: function() {
		$('#jobSummaryViewLink').addClass('active');
		$('#jobSummaryView').show();
		$('#jobLogViewLink').removeClass('active');
		$('#jobLogView').hide();
	},
});

var showDialog = function(title, message) {
  $('#messageTitle').text(title);
  $('#messageBox').text(message);
  $('#messageDialog').modal({
		closeHTML: "<a href='#' title='Close' class='modal-close'>x</a>",
		position: ["20%",],
		containerId: 'confirm-container',
		containerCss: {
			'height': '220px',
			'width': '565px'
		},
		onShow: function (dialog) {
		}
	});
}

$(function() {
	var selected;
	logModel = new azkaban.LogModel();
	jobLogView = new azkaban.JobLogView({
		el: $('#jobLogView'), 
		model: logModel
	});

	summaryModel = new azkaban.SummaryModel();
	jobSummaryView = new azkaban.JobSummaryView({
		el: $('#jobSummaryView'), 
		model: summaryModel
	});

	jobTabView = new azkaban.JobTabView({
		el: $('#headertabs')
	});

	if (window.location.hash) {
		var hash = window.location.hash;
		if (hash == '#joblog') {
			jobTabView.handleJobLogViewLinkClick();
		}
		else if (hash == '#jobsummary') {
			jobTabView.handleJobSummaryViewLinkClick();
		}
	}
});
