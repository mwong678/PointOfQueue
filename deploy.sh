git add -A;
git commit -m 'deploy to heroku';
git push;
git push heroku master;
heroku logs --tail;
