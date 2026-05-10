import { useState } from 'react';
import { CategoryRail } from './category-rail';
import type { CategoryKey } from './types';
import type { Meta, StoryObj } from '@storybook/react';

const labels: Record<CategoryKey, string> = {
  all: 'All',
  core: 'Core',
  food: 'Food',
  feelings: 'Feelings',
  people: 'People',
  actions: 'Actions',
  places: 'Places',
  time: 'Time',
};

const meta: Meta<typeof CategoryRail> = {
  component: CategoryRail,
};
export default meta;
type Story = StoryObj<typeof CategoryRail>;

export const Interactive: Story = {
  render: () => {
    function Demo() {
      const [active, setActive] = useState<CategoryKey>('all');
      return <CategoryRail active={active} onChange={setActive} labels={labels} />;
    }
    return <Demo />;
  },
};
