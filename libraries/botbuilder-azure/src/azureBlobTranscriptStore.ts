/**
 * @module botbuilder-azure
 */
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as azure from 'azure-storage';
import { Activity, PagedResult, Transcript, TranscriptStore } from 'botbuilder';
import { escape } from 'querystring';
import { BlobStorageSettings } from './blobStorage';

const ContainerNameCheck = new RegExp('^[a-z0-9](?!.*--)[a-z0-9-]{1,61}[a-z0-9]$');

/**
 * @private
 * Internal dictionary with the containers where entities will be stored.
 */
const checkedCollections: { [key: string]: Promise<azure.BlobService.ContainerResult>; } = {};

/**
 * Stores transcripts in an Azure Blob container.
 *
 * @remarks
 * Each activity is stored as JSON blob with a structure of
 * `container/{channelId]/{conversationId}/{Timestamp.ticks}-{activity.id}.json`.
 */
export class AzureBlobTranscriptStore implements TranscriptStore {
    private settings: BlobStorageSettings;
    private client: BlobServiceAsync;
    private pageSize = 20;

    /**
     * Creates a new AzureBlobTranscriptStore instance.
     * @param settings Settings required for configuring an instance of BlobStorage
     */
    public constructor(settings: BlobStorageSettings) {
        if (!settings) {
            throw new Error('The settings parameter is required.');
        }

        if (!settings.containerName) {
            throw new Error('The containerName is required.');
        }

        if (!this.checkContainerName(settings.containerName)) {
            throw new Error('Invalid container name.');
        }

        this.settings = {...settings};
        this.client = this.createBlobService(this.settings.storageAccountOrConnectionString, this.settings.storageAccessKey, this.settings.host);
    }

    /**
     * Log an activity to the transcript.
     * @param activity Activity being logged.
     */
    public logActivity(activity: Activity): void | Promise<void> {
        if (!activity) {
            throw new Error('Missing activity.');
        }

        const blobName = this.getBlobName(activity);
        const data = JSON.stringify(activity);

        return this.ensureContainerExists().then((container) => {
            const writeProperties = () => this.client.setBlobPropertiesAsync(container.name, blobName, {
                contentType: 'application/json'
            });

            const writeMetadata = () => this.client.setBlobMetadataAsync(container.name, blobName, {
                fromid: activity.from.id,
                recipientid: activity.recipient.id,
                timestamp: activity.timestamp.getTime().toString()
            });

            const writeData = () => this.client.createBlockBlobFromTextAsync(container.name, blobName, data, null);

            return writeData().then(writeProperties).then(writeMetadata).then(() => {});
        });

    }

    /**
     * Get activities for a conversation (Aka the transcript)
     * @param channelId Channel Id.
     * @param conversationId Conversation Id.
     * @param continuationToken Continuatuation token to page through results.
     * @param startDate Earliest time to include.
     */
    public getTranscriptActivities(channelId: string, conversationId: string, continuationToken?: string, startDate?: Date): Promise<PagedResult<Activity>> {
        if (!channelId) {
            throw new Error('Missing channelId');
        }

        if (!conversationId) {
            throw new Error('Missing conversationId');
        }

        if (!startDate) {
            startDate = new Date(0);
        }

        const prefix = this.getDirName(channelId, conversationId) + '/';
        const token = null;

        return this.ensureContainerExists()
        .then(container => this.getActivityBlobs([], container.name, prefix, continuationToken, startDate, token))
        .then((blobs) => {
            return Promise.all(blobs.map(blob => this.blobToActivity(blob)))
            .then((activities) => {
                const pagedResult = new PagedResult<Activity>();
                pagedResult.items = activities;
                if (pagedResult.items.length == this.pageSize) {
                    pagedResult.continuationToken = blobs.slice(-1).pop().name;
                }
                return pagedResult;
            });
        });
    }

    /**
     * List conversations in the channelId.
     * @param channelId Channel Id.
     * @param continuationToken Continuatuation token to page through results.
     */
    public listTranscripts(channelId: string, continuationToken?: string): Promise<PagedResult<Transcript>> {
        if (!channelId) {
            throw new Error('Missing channelId');
        }

        const prefix = this.getDirName(channelId) + '/';
        const token = null;

        return this.ensureContainerExists()
        .then(container => this.getTranscriptsFolders([], container.name, prefix, continuationToken, channelId, token))
        .then(transcripts => {
            const pagedResult = new PagedResult<Transcript>();
            pagedResult.items = transcripts;
            if (pagedResult.items.length == this.pageSize) {
                    pagedResult.continuationToken = transcripts.slice(-1).pop().id;
                }
            return pagedResult;
        });
    }

    /**
     * Delete a specific conversation and all of it's activities.
     * @param channelId Channel Id where conversation took place.
     * @param conversationId Id of the conversation to delete.
     */
    public deleteTranscript(channelId: string, conversationId: string): Promise<void> {
        if (!channelId) {
            throw new Error('Missing channelId');
        }

        if (!conversationId) {
            throw new Error('Missing conversationId');
        }

        const prefix = this.getDirName(channelId, conversationId) + '/';
        const token = null;

        return this.ensureContainerExists()
        .then(container => this.getConversationsBlobs([], container.name, prefix, token))
        .then(blobs => Promise.all(blobs.map(blob => this.client.deleteBlobIfExistsAsync(blob.container, blob.name))))
        .then(results => { });
    }

    private blobToActivity(blob: azure.BlobService.BlobResult): Promise<Activity> {
        return this.client.getBlobToTextAsync(blob.container, blob.name)
        .then((content) => {
            const activity = JSON.parse(content as any) as Activity;
            activity.timestamp = new Date(activity.timestamp);
            return activity;
        });
    }

    private getActivityBlobs(blobs: azure.BlobService.BlobResult[], container: string, prefix: string, continuationToken: string, startDate: Date, token: azure.common.ContinuationToken): Promise<azure.BlobService.BlobResult[]> {
        return new Promise((resolve, reject) => {
            this.client.listBlobsSegmentedWithPrefixAsync(container, prefix, token, { include: 'metadata' })
            .then((result) => {
                result.entries.some((blob) => {
                    const timestamp = Number.parseInt(blob.metadata.timestamp, 10);
                    if (timestamp >= startDate.getTime()) {
                        if (continuationToken) {
                            if (blob.name === continuationToken) {
                                continuationToken = null;
                            }
                        } else {
                            blob.container = container;
                            blobs.push(blob);
                            return (blobs.length === this.pageSize);
                        }
                    }
                    return false;
                });
                if (result.continuationToken && blobs.length < this.pageSize) {
                    resolve(this.getActivityBlobs(blobs, container, prefix, continuationToken, startDate, result.continuationToken));
                }
                resolve(blobs);
            })
            .catch(reject);
        });
    }

    private getTranscriptsFolders(transcripts: Transcript[], container: string, prefix: string, continuationToken: string, channelId: string, token: azure.common.ContinuationToken): Promise<Transcript[]> {
        return new Promise((resolve, reject) => {
            this.client.listBlobDirectoriesSegmentedWithPrefixAsync(container, prefix, token).then((result) => {
                result.entries.some((blob) => {
                    const conversation = new Transcript();
                    conversation.id = blob.name.split('/').filter(part => part).slice(-1).pop();
                    conversation.channelId = channelId;
                    if (continuationToken) {
                        if (conversation.id === continuationToken) {
                            continuationToken = null;
                        }
                    } else {
                        transcripts.push(conversation);
                        return (transcripts.length === this.pageSize);
                    }
                    return false;
                });
                if (result.continuationToken && transcripts.length < this.pageSize) {
                    resolve(this.getTranscriptsFolders(transcripts, container, prefix, continuationToken, channelId, result.continuationToken));
                }
                resolve(transcripts);
            })
            .catch(reject);
        });
    }

    private getConversationsBlobs(blobs: azure.BlobService.BlobResult[], container: string, prefix: string, token: azure.common.ContinuationToken): Promise<azure.BlobService.BlobResult[]> {
        return new Promise((resolve, reject) => {
            this.client.listBlobsSegmentedWithPrefixAsync(container, prefix, token, null)
            .then((result) => {
                blobs = blobs.concat(result.entries.map(blob => {
                    blob.container = container;
                    return blob;
                }));
                if (result.continuationToken) {
                    resolve(this.getConversationsBlobs(blobs, container, prefix, result.continuationToken));
                }
                resolve(blobs);
            })
            .catch(reject);
        });
    }

    private checkContainerName(container: string): boolean {
        return ContainerNameCheck.test(container);
    }

    private getBlobName(activity: Activity): string {
        const channelId = this.sanitizeKey(activity.channelId);
        const conversationId = this.sanitizeKey(activity.conversation.id);
        const timestamp = this.sanitizeKey(this.getTicks(activity.timestamp));
        const activityId = this.sanitizeKey(activity.id);
        return `${channelId}/${conversationId}/${timestamp}-${activityId}.json`;
    }

    private getDirName(channelId: string, conversationId?: string): string {
        if (!conversationId) {
            return this.sanitizeKey(channelId);
        }
        return `${this.sanitizeKey(channelId)}/${this.sanitizeKey(conversationId)}`;
    }

    private sanitizeKey(key: string): string {
        return escape(key);
    }

    private getTicks(timestamp: Date): string {
        const epochTicks = 621355968000000000; // the number of .net ticks at the unix epoch
        const ticksPerMillisecond = 10000; // there are 10000 .net ticks per millisecond

        const ticks = epochTicks + (timestamp.getTime() * ticksPerMillisecond);
        return ticks.toString(16);
    }

    private ensureContainerExists(): Promise<azure.BlobService.ContainerResult> {
        const key = this.settings.containerName;
        if (!checkedCollections[key]) {
            checkedCollections[key] = this.client.createContainerIfNotExistsAsync(key);
        }
        return checkedCollections[key];
    }

    private createBlobService(storageAccountOrConnectionString: string, storageAccessKey: string, host: any): BlobServiceAsync {
        if (!storageAccountOrConnectionString) {
            throw new Error('The storageAccountOrConnectionString parameter is required.');
        }

        const blobService = azure.createBlobService(storageAccountOrConnectionString, storageAccessKey, host).withFilter(new azure.LinearRetryPolicyFilter(5, 500));

        // create BlobServiceAsync by using denodeify to create promise wrappers around cb functions
        return {...blobService as any, 
            createContainerIfNotExistsAsync: this.denodeify(blobService, blobService.createContainerIfNotExists),
            deleteContainerIfExistsAsync: this.denodeify(blobService, blobService.deleteContainerIfExists),

            createBlockBlobFromTextAsync: this.denodeify(blobService, blobService.createBlockBlobFromText),
            getBlobMetadataAsync: this.denodeify(blobService, blobService.getBlobMetadata),
            setBlobMetadataAsync: this.denodeify(blobService, blobService.setBlobMetadata),
            getBlobPropertiesAsync: this.denodeify(blobService, blobService.getBlobProperties),
            setBlobPropertiesAsync: this.denodeify(blobService, blobService.setBlobProperties),
            getBlobToTextAsync: this.denodeify(blobService, blobService.getBlobToText),
            deleteBlobIfExistsAsync: this.denodeify(blobService, blobService.deleteBlobIfExists),
            listBlobsSegmentedWithPrefixAsync: this.denodeify(blobService, blobService.listBlobsSegmentedWithPrefix),
            listBlobDirectoriesSegmentedWithPrefixAsync: this.denodeify(blobService, blobService['listBlobDirectoriesSegmentedWithPrefix'])};
    }

    // turn a cb based azure method into a Promisified one
    private denodeify<T>(thisArg: any, fn: Function): (...args: any[]) => Promise<T> {
        return (...args: any[]) => {
            return new Promise<T>((resolve, reject) => {
                args.push((error: Error, result: any) => (error) ? reject(error) : resolve(result));
                fn.apply(thisArg, args);
            });
        };
    }
}

/**
 * @private
 * Promise based methods created using denodeify function
 */
interface BlobServiceAsync extends azure.BlobService {
    createContainerIfNotExistsAsync(container: string): Promise<azure.BlobService.ContainerResult>;
    deleteContainerIfExistsAsync(container: string): Promise<boolean>;

    createBlockBlobFromTextAsync(container: string, blob: string, text: string | Buffer, options: azure.BlobService.CreateBlobRequestOptions): Promise<azure.BlobService.BlobResult>;
    getBlobMetadataAsync(container: string, blob: string): Promise<azure.BlobService.BlobResult>;
    setBlobMetadataAsync(container: string, blob: string, metadata: { [index: string] : string }): Promise<azure.BlobService.BlobResult>;
    getBlobPropertiesAsync(container: string, blob: string): Promise<azure.BlobService.BlobResult>;
    setBlobPropertiesAsync(container: string, blob: string, propertiesAndOptions: azure.BlobService.SetBlobPropertiesRequestOptions): Promise<azure.BlobService.BlobResult>;
    getBlobToTextAsync(container: string, blob: string): Promise<azure.BlobService.BlobToText>;
    deleteBlobIfExistsAsync(container: string, blob: string): Promise<boolean>;
    listBlobsSegmentedWithPrefixAsync(container: string, prefix: string, currentToken: azure.common.ContinuationToken, options: azure.BlobService.ListBlobsSegmentedRequestOptions): Promise<azure.BlobService.ListBlobsResult>;
    listBlobDirectoriesSegmentedWithPrefixAsync(container: string, prefix: string, currentToken: azure.common.ContinuationToken): Promise<azure.BlobService.ListBlobsResult>;
}
