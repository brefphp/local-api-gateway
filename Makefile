release:
	npm run build
	npm version patch
	npm run docker-publish
	export NPM_TOKEN=$NPM_TOKEN_LOCAL_API_GATEWAY && npm publish --access public --tag=latest
	echo "Now push the tag to github!"
