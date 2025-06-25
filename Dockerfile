FROM archlinux:latest

# Create user and directories
RUN groupadd -r miyritsu
RUN useradd -r -m -g miyritsu miyritsu
RUN mkdir /app
RUN chown -R miyritsu:miyritsu /app

# ---------- Root ---------- #
USER root

ARG PACMAN_PARALLELDOWNLOADS=5
RUN pacman-key --init \
    && pacman -Sy --noconfirm --noprogressbar --quiet --needed pacman-contrib \
    && sed -i "s/^ParallelDownloads.*/ParallelDownloads = ${PACMAN_PARALLELDOWNLOADS}/g" /etc/pacman.conf

# Install basic tools
RUN pacman -Syu --noconfirm base base-devel git sudo go wget lldb

# ---------- miyritsu ---------- #
USER miyritsu

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

ENV PATH="$PATH:/home/miyritsu/.cargo/bin"

RUN rustup default stable

ENV TERM=xterm
ENV FORCE_COLOR=true

WORKDIR /app
