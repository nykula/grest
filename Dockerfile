FROM archlinux/base
RUN pacman -Syu --noconfirm git gjs libsoup npm
RUN pacman -S --noconfirm libgda

ADD . /root
ENV HOME /root
WORKDIR /root
RUN npm i

EXPOSE 8080
ENV PORT 8080
CMD ["npm", "start"]
