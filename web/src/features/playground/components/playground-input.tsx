/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState } from 'react'
import {
  PaperclipIcon,
  FileIcon,
  ImageIcon,
  ScreenShareIcon,
  CameraIcon,
  GlobeIcon,
  SendIcon,
  SquareIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { ModelGroupSelector } from '@/components/model-group-selector'
import type { ModelOption, GroupOption, QuickPrompt } from '../types'
import { PlaygroundModelCompare } from './playground-model-compare'

interface PlaygroundInputProps {
  onSubmit: (text: string) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  compareMode: boolean
  compareModels: string[]
  onCompareModeChange: (value: boolean) => void
  onCompareModelsChange: (value: string[]) => void
  isModelLoading?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
  quickPrompts: QuickPrompt[]
  onQuickPromptsChange: (
    updater: QuickPrompt[] | ((prev: QuickPrompt[]) => QuickPrompt[])
  ) => void
  onCreateSession: () => void
}

export function PlaygroundInput({
  onSubmit,
  onStop,
  disabled,
  isGenerating,
  models,
  modelValue,
  onModelChange,
  compareMode,
  compareModels,
  onCompareModeChange,
  onCompareModelsChange,
  isModelLoading = false,
  groups,
  groupValue,
  onGroupChange,
  quickPrompts,
  onQuickPromptsChange,
  onCreateSession,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)

  const isModelSelectDisabled =
    disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0
  const visibleQuickPrompts = quickPrompts.filter(
    (prompt) => prompt.name.trim() && prompt.prompt.trim()
  )

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim() || disabled) return
    onSubmit(message.text)
    setText('')
  }

  const handleFileAction = (action: string) => {
    toast.info(t('Feature in development'), {
      description: action,
    })
  }

  const handlePromptChange = (
    promptId: string,
    field: keyof Pick<QuickPrompt, 'name' | 'prompt'>,
    value: string
  ) => {
    onQuickPromptsChange((prev) =>
      prev.map((prompt) =>
        prompt.id === promptId ? { ...prompt, [field]: value } : prompt
      )
    )
  }

  const handleAddPrompt = () => {
    onQuickPromptsChange((prev) => [
      ...prev,
      {
        id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: t('New prompt'),
        prompt: '',
      },
    ])
  }

  const handleDeletePrompt = (promptId: string) => {
    onQuickPromptsChange((prev) =>
      prev.length <= 1 ? prev : prev.filter((prompt) => prompt.id !== promptId)
    )
  }

  return (
    <div className='grid shrink-0 gap-3 px-3 pb-3 md:px-1 md:pb-4'>
      <div className='flex min-w-0 items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='gap-1.5'
          onClick={onCreateSession}
        >
          <PlusIcon className='size-3.5' />
          {t('New session')}
        </Button>

        <div className='min-w-0 flex-1'>
          <Suggestions>
            {visibleQuickPrompts.map((prompt) => (
              <Suggestion
                className='text-xs font-normal sm:text-sm'
                key={prompt.id}
                onClick={() => setText(prompt.prompt)}
                suggestion={prompt.prompt}
              >
                {prompt.name}
              </Suggestion>
            ))}
          </Suggestions>
        </div>

        <Button
          type='button'
          variant='outline'
          size='icon-sm'
          onClick={() => setPromptDialogOpen(true)}
          aria-label={t('Manage quick prompts')}
        >
          <Settings2Icon className='size-4' />
        </Button>
      </div>

      <PlaygroundModelCompare
        enabled={compareMode}
        models={models}
        selectedModels={compareModels}
        disabled={disabled || isModelLoading}
        onEnabledChange={onCompareModeChange}
        onSelectedModelsChange={onCompareModelsChange}
      />

      <PromptInput groupClassName='rounded-xl' onSubmit={handleSubmit}>
        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='px-5 md:text-base'
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask anything')}
          value={text}
        />

        <PromptInputFooter className='p-2.5'>
          <PromptInputTools>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <PromptInputButton
                    className='border font-medium'
                    disabled={disabled}
                    variant='outline'
                  />
                }
              >
                <PaperclipIcon size={16} />
                <span className='hidden sm:inline'>{t('Attach')}</span>
                <span className='sr-only sm:hidden'>{t('Attach')}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                <DropdownMenuItem
                  onClick={() => handleFileAction('upload-file')}
                >
                  <FileIcon className='mr-2' size={16} />
                  {t('Upload file')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('upload-photo')}
                >
                  <ImageIcon className='mr-2' size={16} />
                  {t('Upload photo')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('take-screenshot')}
                >
                  <ScreenShareIcon className='mr-2' size={16} />
                  {t('Take screenshot')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleFileAction('take-photo')}
                >
                  <CameraIcon className='mr-2' size={16} />
                  {t('Take photo')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <PromptInputButton
              className='border font-medium'
              disabled={disabled}
              onClick={() => toast.info(t('Search feature in development'))}
              variant='outline'
            >
              <GlobeIcon size={16} />
              <span className='hidden sm:inline'>{t('Search')}</span>
              <span className='sr-only sm:hidden'>{t('Search')}</span>
            </PromptInputButton>
          </PromptInputTools>

          <div className='flex items-center gap-1.5 md:gap-2'>
            <ModelGroupSelector
              selectedModel={modelValue}
              models={models}
              onModelChange={onModelChange}
              selectedGroup={groupValue}
              groups={groups}
              onGroupChange={onGroupChange}
              disabled={isModelSelectDisabled || isGroupSelectDisabled}
            />

            {isGenerating && onStop ? (
              <PromptInputButton
                className='text-foreground font-medium'
                onClick={onStop}
                variant='secondary'
              >
                <SquareIcon className='fill-current' size={16} />
                <span className='hidden sm:inline'>{t('Stop')}</span>
                <span className='sr-only sm:hidden'>{t('Stop')}</span>
              </PromptInputButton>
            ) : (
              <PromptInputButton
                className='text-foreground font-medium'
                disabled={disabled || !text.trim()}
                type='submit'
                variant='secondary'
              >
                <SendIcon size={16} />
                <span className='hidden sm:inline'>{t('Send')}</span>
                <span className='sr-only sm:hidden'>{t('Send')}</span>
              </PromptInputButton>
            )}
          </div>
        </PromptInputFooter>
      </PromptInput>

      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className='max-h-[85vh] max-w-2xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{t('Quick prompts')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            {quickPrompts.map((prompt, index) => (
              <div key={prompt.id} className='rounded-lg border p-3'>
                <div className='mb-3 flex items-center justify-between gap-2'>
                  <span className='text-sm font-medium'>
                    {t('Prompt')} {index + 1}
                  </span>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    disabled={quickPrompts.length <= 1}
                    onClick={() => handleDeletePrompt(prompt.id)}
                    aria-label={t('Delete prompt')}
                  >
                    <Trash2Icon className='size-4' />
                  </Button>
                </div>
                <div className='grid gap-3'>
                  <div className='grid gap-1.5'>
                    <Label>{t('Name')}</Label>
                    <Input
                      value={prompt.name}
                      onChange={(event) =>
                        handlePromptChange(
                          prompt.id,
                          'name',
                          event.target.value
                        )
                      }
                      placeholder={t('Prompt name')}
                    />
                  </div>
                  <div className='grid gap-1.5'>
                    <Label>{t('Prompt')}</Label>
                    <Textarea
                      value={prompt.prompt}
                      onChange={(event) =>
                        handlePromptChange(
                          prompt.id,
                          'prompt',
                          event.target.value
                        )
                      }
                      placeholder={t('Prompt content')}
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleAddPrompt}>
              <PlusIcon className='size-4' />
              {t('Add prompt')}
            </Button>
            <Button type='button' onClick={() => setPromptDialogOpen(false)}>
              {t('Done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
