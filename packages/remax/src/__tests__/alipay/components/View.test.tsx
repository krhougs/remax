import * as React from 'react';
import TestRenderer from 'react-test-renderer';
import View from '../../../adapters/alipay/components/View';

describe('View', () => {
  it('render correctly', () => {
    const testRenderer = TestRenderer.create(
      <View className="class">view</View>
    );

    expect(testRenderer.toJSON()).toMatchSnapshot();
  });
});
