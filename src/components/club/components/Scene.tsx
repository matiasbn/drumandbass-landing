'use client';

import React, { Suspense, MutableRefObject } from 'react';
import { DanceFloor } from './DanceFloor';
import { DJBooth } from './DJBooth';
import { DJ } from './DJ';
import { DancerGroup } from './DancerGroup';
import { PlayerDancer } from './PlayerDancer';
import { OtherPlayers } from './OtherPlayers';
import { LogoBanner } from './LogoBanner';
import { Lighting } from './Lighting';
import { StageElements } from './StageElements';
import { Background } from './Background';
import { JungleDecor } from './JungleDecor';

interface SceneProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const Scene: React.FC<SceneProps> = ({ isPlayingRef }) => {
  return (
    <>
      <Background isPlayingRef={isPlayingRef} />
      <Lighting isPlayingRef={isPlayingRef} />
      <Suspense fallback={null}>
        <LogoBanner />
      </Suspense>
      <DanceFloor />
      <DJBooth />
      <DJ isPlayingRef={isPlayingRef} />
      <DancerGroup isPlayingRef={isPlayingRef} />
      <PlayerDancer isPlayingRef={isPlayingRef} />
      <OtherPlayers isPlayingRef={isPlayingRef} />
      <StageElements isPlayingRef={isPlayingRef} />
      <JungleDecor isPlayingRef={isPlayingRef} />
    </>
  );
};
