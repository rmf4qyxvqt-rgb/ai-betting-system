from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    sport = Column(String, index=True, nullable=False)


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    home_team = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team = Column(Integer, ForeignKey("teams.id"), nullable=False)
    date = Column(DateTime, index=True, nullable=False)
    sport = Column(String, index=True, nullable=False)

    home_team_rel = relationship("Team", foreign_keys=[home_team])
    away_team_rel = relationship("Team", foreign_keys=[away_team])
    stat = relationship("Stat", uselist=False, back_populates="match", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="match", cascade="all, delete-orphan")


class Stat(Base):
    __tablename__ = "stats"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), unique=True, nullable=False)
    goals = Column(Integer, default=0, nullable=False)
    corners = Column(Integer, default=0, nullable=False)
    shots = Column(Integer, default=0, nullable=False)
    shots_on_target = Column(Integer, default=0, nullable=False)
    cards = Column(Integer, default=0, nullable=False)
    points = Column(Integer, default=0, nullable=False)

    match = relationship("Match", back_populates="stat")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    market = Column(String, index=True, nullable=False)
    probability = Column(Float, nullable=False)
    odds = Column(Float, nullable=False)
    ev = Column(Float, index=True, nullable=False)
    score = Column(Float, index=True, nullable=False)
    recommended = Column(Boolean, default=False, nullable=False)
    analise_avancada = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    match = relationship("Match", back_populates="predictions")
