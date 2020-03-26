// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: magic;


const defaultScope = [
	'user-modify-playback-state',
	'user-read-playback-state',
	'user-read-currently-playing',
	'user-library-read',
	'playlist-read-private',
	'app-remote-control',
	'streaming',
]
class Spotify {
	constructor(client_id, client_secret, scope = defaultScope) {
		this.client_id = client_id;
		this.client_secret = client_secret;
		this.scope = scope;
		this.redirect_uri = 'scriptable://///run?scriptName=' + Script.name();
		this.key_name = Script.name() + '_';
		this.endpoint = 'https://api.spotify.com';
		this.token_data = null;
		console.log(this.redirect_uri)
	}

	async authorize() {
		const url = `https://accounts.spotify.com/authorize?client_id=${
			this.client_id
		}&redirect_uri=${encodeURIComponent(this.redirect_uri)}&scope=${encodeURIComponent(
			this.scope.join(' ')
		)}&response_type=code`;
		Safari.open(url);
	}
	
	async getAccessToken(code) {
		try {
			const req = new Request('https://accounts.spotify.com/api/token');
			req.method = 'post';
			req.headers = {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
			};
			req.body = encodeURI(
				`grant_type=authorization_code&code=${code}&redirect_uri=${this.redirect_uri}&client_id=${this.client_id}&client_secret=${this.client_secret}`
			);
			const res = await req.loadJSON();
			res.exp_date = Date.now() + (res.expires_in * 1000);
			Keychain.set(this.key_name, JSON.stringify(res));
			return true;
		} catch (e) {
			return false;
		}
	}


	async refreshAccessToken() {
		const req = new Request('https://accounts.spotify.com/api/token');
		req.method = 'post';
		req.headers = {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			Authorization: `Basic ${Data.fromString(
				`${this.client_id}:${this.client_secret}`
			).toBase64String()}`
		};
		req.body = encodeURI(
			`grant_type=refresh_token&refresh_token=${this.token_data.refresh_token}`
		);
		const res = await req.loadJSON();
		this.token_data.access_token = res.access_token;
		this.token_data.expires_in = res.expires_in;
		this.token_data.exp_dat = Date.now() + (res.expires_in * 1000);
		// Save new token
		Keychain.set(this.key_name, JSON.stringify(this.token));
	}

	async apiRequest(url, method='get', body=null, params) {
		let paramString = '';
		if(params) {
			paramString = '?' + Object.entries(params).map(([key, value]) => {
				return `${key}=${encodeURIComponent(value)}`;
			}).join('&');
		}
		const req = new Request(`https://api.spotify.com/v1/${url}${paramString}`);
		console.log(req.url)
		req.method = method;
		req.headers = {
			Authorization: `Bearer ${this.token_data.access_token}`,
			'Content-Type': 'application/json; charset=UTF-8'
		};

		if(body) {
			req.body = JSON.stringify(body);
		}
		const res = await req.loadString();
		try{
			const data = JSON.parse(res);
			return data;
		}catch(e) {
			return res;
		}
	}

	async devices() {
		const res = await this.apiRequest('me/player/devices');
		return res.devices.map(e => new SpotifyDevice(this, e));
	}

	async init() {
		const code = URLScheme.parameter('code');
		if(code) {
			await this.getAccessToken(code);
		} else if(!Keychain.contains(this.key_name)) {
			await this.authorize();
		}else {
			this.token_data = JSON.parse(Keychain.get(this.key_name));
			if(this.token_data.exp_date <= Date.now()) {
				await this.refreshAccessToken();
			}
		}
	}
}

class SpotifyDevice {
	constructor(client, data) {
		this.client = client;
		Object.assign(this, data);
	}
	
	async play (body={}) {
		if(typeof body === 'string') {
			if(body.indexOf(':track:') !== -1) {
				body = {uris: [body]}
			}else {
				body = {context_uri: body}
			}
		}
		await this.client.apiRequest('me/player/play', 'put', body, {
			device_id: this.id
		});
	}
	
	async pause () {
		await this.client.apiRequest('me/player/pause', 'put', null, {
			device_id: this.id
		});
	}
	
	async next () {
		await this.client.apiRequest('me/player/next', 'post', null, {
			device_id: this.id
		});
	}
	
	async previous () {
		await this.client.apiRequest('me/player/previous', 'post', null, {
			device_id: this.id
		});
	}
	
	async shuffle (state = true) {
		await this.client.apiRequest('me/player/shuffle', 'put', null, {
			device_id: this.id,
			state: state
		});
	}
	
	async transfer (device) {
		await this.client.apiRequest('me/player', 'put', null, {
			device_id: device.id,
			play: true
		});
	}
	
	async volume (volume_percent=10) {
		await this.client.apiRequest('me/player/volume', 'put', null, {
			device_id: this.id,
			volume_percent: volume_percent
		});
	}
	
	async current () {
		return await this.client.apiRequest('me/player/currently-playing', 'get', null, null);
	}
	
	async queue (uri) {
		return await this.client.apiRequest('me/player/queue', 'post', null, {
			device_id: this.id,
			uri: uri
		});
	}
}


module.exports = Spotify;