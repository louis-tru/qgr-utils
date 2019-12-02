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

var util = require('./util');
var {List} = require('./event');
var http = require('http');
var https = require('https');
var url = require('url');
var fs = require('fs');
var errno = require('./errno');
var { userAgent } = require('./request');

function wget(www, save, options) { // 206
	var { renewal = false,
				limit = wget.LIMIT, // limit rate byte/second
				// limitTime = 0, // limt network use time
				onProgress,
				timeout = 12e4, } = options || {};

	limit = Number(limit) || 0;
	renewal = renewal || options.broken_point || false;
	onProgress = onProgress || options.progress || util.noop;

	var promise = new Promise((resolve, reject)=> {
		var uri = url.parse(String(www));
		var isSSL = uri.protocol == 'https:';
		var lib =	isSSL ? https: http;

		var options = {
			hostname: uri.hostname,
			port: Number(uri.port) || (isSSL ? 443: 80),
			path: uri.path,
			method: 'GET',
			headers: {
				'User-Agent': userAgent,
			},
			rejectUnauthorized: false,
			timeout: timeout || 12e4,
		};

		if (isSSL) {
			options.agent = new https.Agent(options);
		}

		fs.stat(save, function(err, stat) {
			var start_range = 0;
			var download_total = 0;
			var download_size = 0;

			if (renewal) {
				if (!err) {
					if (stat.isFile()) {
						start_range = stat.size;
						download_size = start_range;
					} else {
						return reject(Error.new(errno.ERR_DOWNLOAD_FAIL));
					}
				}
				if (start_range) {
					options.headers.range = 'bytes=' + start_range + '-';
				}
			}

			var ok = false;
			var fd = 0;
			var res_end = false;
			var buffers = new List();

			function error(err) {
				if (!ok) {
					ok = true;
					if (fd) {
						var _fd = fd; fd = 0;
						fs.close(_fd, e=>reject(err));
					} else {
						reject(err);
					}
				}
			}

			function write() {
				if (fd) {
					if (buffers.length) {
						fs.write(fd, buffers.first.value, function(err) {
							if (err) {
								error(err);
								req.abort();
							} else {
								buffers.shift();
								write();
							}
						});
					} else if (res_end) {
						ok = true;
						var _fd = fd; fd = 0;
						fs.close(_fd, e=>resolve({ total: download_total, size: download_size }));
					}
				}
			}

			// new request 
			var req = lib.request(options, (res)=> {
				promise.request = req;

				if (res.statusCode == 200 || res.statusCode == 206) {
					res.pause();
					res.client.setNoDelay(true);
					res.client.setKeepAlive(true, 3e4); // 30s
					res.client.on('error', e=>error(e));
					res.on('error', e=>error(e));

					var speed = 0; // speed / 3 second
					var time = 0;
					var ptime = 0; // pause time

					res.on('data', (chunk)=>{
						download_size += chunk.length;

						var st = Date.now();
						var ts = st - time; // time span
						if (ts) {
							var ispeed = chunk.length / ts * 1e3; // instantaneous speed/second
							// speed = (speed + ispeed * 0.11) * 0.901; // (100 + 100 * 0.11) * 0.901, Finally converges to ispeed
							speed = (speed + ispeed * 0.25) * 0.8; // (100 + 100 * 0.25) * 0.8, Finally converges to ispeed

							// limit flow, byte/second
							if (limit && time) {
								if (speed > limit) {
									ptime = Math.min(1e4, ptime + 5); // increase
								} else {
									ptime = Math.max(0, ptime - 5); // lessen
								}
								if (ptime > 0) {
									res.pause();
									util.sleep(ptime).then(e=>res.resume()).catch(e=>{});
								}
							}
							time = st;
							// console.log(Math.floor(speed / 1024), Math.floor(ispeed / 1024));
						}

						try {
							onProgress({ total: download_total, size: download_size, speed });
						} catch(e) {
							console.error(e);
						}

						buffers.push(chunk);

						if (buffers.length == 1)
							write();
					});

					res.on('end', ()=>{
						res_end = true;
						if (buffers.length == 0)
							write();
					});

					var flag = 'w';

					// set file open flag
					if (start_range && 
							res.statusCode == 206 && 
							res.headers['accept-ranges'] == 'bytes') 
					{
						var content_range = res.headers['content-range'];
						var m = content_range.match(/^bytes\s(\d+)-/);
						if (m && Number(m[1]) == start_range) {
							flag = 'a';
						}
					}

					// set content total size
					download_total = Number(res.headers['content-length']) || 0;
					if (download_total) {
						if (flag == 'a') {
							download_total += download_size;
						}
					}
					
					fs.open(save, flag, function(err, _fd) {
						if (err) {
							error(err);
							req.abort();
						} else {
							fd = _fd;
							res.resume();
						}
					});
				} else {
					var err = Error.new(errno.ERR_DOWNLOAD_FAIL);
					err.url = www;
					err.save = save;
					err.statusCode = res.statusCode;
					err.httpVersion = res.httpVersion;
					err.headers = res.headers;
					error(err);
					req.abort();
				}
			});

			req.on('abort', e=>error(errno.ERR_REQUEST_ABORT));
			req.on('error', e=>error(e));
			req.on('timeout', e=>{
				error(Error.new(errno.ERR_HTTP_REQUEST_TIMEOUT));
				req.abort();
			});
			req.end(); // send
		});

		// 
	});

	promise.request = null;

	return promise;
}

wget.LIMIT = 0;

module.exports = wget;
