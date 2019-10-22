/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2015, xuewen.chu
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of xuewen.chu nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL xuewen.chu BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

var utils = require('../util');
var event = require('../event');
var service = require('../service');
var path = require('../path');
var {ClientService} = require('../cli_service');
var {WSConversation,Client} = require('../cli');

// Fast Message Transfer Center, 快速消息传输中心

/**
 * @class FastMessageTransferCenter
 */
class FastMessageTransferCenter extends ClientService {

	constructor(conv) {
		super(conv);
		// conv.onPing.on(e=>desktop.clientReport());
	}

}

/**
 * @class FMTClient
 */
class FMTClient extends event.Notification {

	get id() {
		return this.m_id;
	}

	get cli() {
		return this.m_cli;
	}

	get conv() {
		return this.m_cli.conv;
	}

	get service() {
		// TODO ...
	}

	constructor(id = utils.random(), url = 'fmt://localhost/') {
		super();
		url = new path.URL(url);
		url.setParam('id', id);
		var s = url.protocol == 'fmts:'? 'wss:': 'ws:';
				s += '//' + url.host + url.path;
		this.m_id = id;
		this.m_url = url;
		// this.m_cli = new Client('fmt', new WSConversation(s));
	}

}

service.set('fmt', FastMessageTransferCenter);

exports.FastMessageTransferCenter = FastMessageTransferCenter;
exports.FMTClient = FMTClient;