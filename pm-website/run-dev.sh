#!/bin/sh

# This script starts the development environment of pm-website using Docker Compose.
# It builds the images defined in the docker-compose.dev.yml file and starts the containers.
docker-compose -p pm-website-multi-pages -f docker-compose.dev.yml up