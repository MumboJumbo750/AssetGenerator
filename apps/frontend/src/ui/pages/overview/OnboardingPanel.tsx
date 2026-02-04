import React from "react";
import { Button, Card, Group, Stack, Stepper, Text } from "@mantine/core";
import { Link } from "react-router-dom";

import { HelpTip } from "../../components/HelpTip";

type Props = {
  activeStep: number;
  verifyLoading: boolean;
  onVerify: () => void;
};

export function OnboardingPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Onboarding wizard</Text>
            <HelpTip label="Follow these steps in order for a clean first run." topicId="workflow-specs" />
          </Group>
          <Button variant="light" onClick={props.onVerify} loading={props.verifyLoading}>
            Verify
          </Button>
        </Group>
        <Stepper active={props.activeStep}>
          <Stepper.Step label="Verify ComfyUI" description="Reachable + workflows + weights">
            <Group>
              <Button variant="light" onClick={props.onVerify} loading={props.verifyLoading}>
                Run verification
              </Button>
              <Button component={Link} to="/logs" variant="light">
                Check logs
              </Button>
            </Group>
          </Stepper.Step>
          <Stepper.Step label="Create SpecList" description="Start with a wishlist">
            <Group>
              <Button component={Link} to="/specs">
                Go to Specs
              </Button>
              <Button component="a" href="docs/how-to-spec.md" variant="light">
                Spec guide
              </Button>
            </Group>
          </Stepper.Step>
          <Stepper.Step label="Refine into Specs" description="Structured AssetSpecs">
            <Button component={Link} to="/specs">
              Refine SpecList
            </Button>
          </Stepper.Step>
          <Stepper.Step label="Queue Jobs" description="Generate variants">
            <Button component={Link} to="/specs">
              Queue generate
            </Button>
          </Stepper.Step>
          <Stepper.Step label="Review Assets" description="Pick primary, tag">
            <Button component={Link} to="/assets">
              Review assets
            </Button>
          </Stepper.Step>
          <Stepper.Completed>
            <Group>
              <Text size="sm">All set! Export and preview your kit.</Text>
              <Button component={Link} to="/pixi" variant="light">
                Preview Pixi export
              </Button>
            </Group>
          </Stepper.Completed>
        </Stepper>
      </Stack>
    </Card>
  );
}
