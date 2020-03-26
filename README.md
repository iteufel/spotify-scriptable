# Spotify Scriptable
Controll your Spotify Connect Speakers using Scriptable.

	let Spotify = importModule('lib.spotify')
	const client = new Spotify('client_id', 'client_secret');
	await client.init();
	const devices = await client.devices();
	const testDevice = devices.find(e => e.name === 'Schlafzimmer');
	await testDevice.volume(10);
	await testDevice.play('spotify:track:0ZZ8VoqXHmTtS6EDmkIxbP');
