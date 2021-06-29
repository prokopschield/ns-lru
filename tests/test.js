const { timingSafeEqual } = require('crypto');
const { getConfig } = require('doge-config');
const fs = require('fs');
const { LRU } = require('..');

module.exports = async function test() {
	const lru = new LRU({
		maxSize: 3,
		store: getConfig('lru-test').obj.store.map,
	});

	const yarnlock = await fs.promises.readFile('yarn.lock');

	lru.set('yarn.lock', yarnlock);

	lru.set('foo', 'bar');
	lru.set('test', Buffer.from('test'));

	for (let i = 0; i < 8; ++i) {
		lru.set(i, i);
	}

	for (let i = 0; i < 8; ++i) {
		const stored = await lru.get(i);
		if (i != stored) {
			throw new Error(`${i} != ${stored}`);
		}
	}

	if ((await lru.get('foo')) !== 'bar') {
		throw new Error('foo !== bar');
	}

	if ((await lru.get('test')).toString() !== 'test') {
		throw new Error('Buffer test failed!');
	}

	if (
		!timingSafeEqual(
			await fs.promises.readFile('yarn.lock'),
			await lru.get('yarn.lock')
		)
	) {
		throw new Error('yarn.lock test failed!');
	}
};
