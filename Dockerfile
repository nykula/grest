FROM ubuntu:17.10

ENV HOME /root
WORKDIR /root

RUN \
  sed -i 's/# \(.*multiverse$\)/\1/g' /etc/apt/sources.list && \
  apt-get update && \
  apt-get -y upgrade && \
  apt-get install -y curl gir1.2-glib-2.0 gir1.2-soup-2.4 git gjs && \
  curl -sL https://deb.nodesource.com/setup_9.x | bash - && \
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
  apt-get update && \
  apt-get install -y nodejs yarn && \
  rm -rf /var/lib/apt/lists/*

ADD . /root
RUN yarn

EXPOSE 8080
ENV PORT 8080
CMD ["yarn", "start"]
