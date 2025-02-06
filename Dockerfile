FROM archlinux:latest

# Create user and directories
RUN groupadd -r ifhany
RUN useradd -r -m -g ifhany ifhany
RUN mkdir /app
RUN chown -R ifhany:ifhany /app

# ---------- Root ---------- #
USER root

ARG PACMAN_PARALLELDOWNLOADS=5
RUN pacman-key --init \
    && pacman -Sy --noconfirm --noprogressbar --quiet --needed pacman-contrib \
    && sed -i "s/^ParallelDownloads.*/ParallelDownloads = ${PACMAN_PARALLELDOWNLOADS}/g" /etc/pacman.conf

# Install basic tools
RUN pacman -Syu --noconfirm base base-devel git sudo go wget lldb

# ---------- ifhany ---------- #
USER ifhany

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

ENV PATH="$PATH:/home/ifhany/.cargo/bin"

RUN rustup default stable

ENV TERM=xterm
ENV FORCE_COLOR=true

WORKDIR /app