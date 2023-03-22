release:
	npm run build
	npm version patch
	npm run docker-publish
	npm publish --access public --tag=latest
	echo "Now push the tag to github!"
