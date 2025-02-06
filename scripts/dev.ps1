
docker rm ifhany_db

docker-compose -f docker-compose.yml -f config/docker-compose_dev.yml up --build --remove-orphans